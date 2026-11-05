# Campus for Windows — build, run, verify

Target: Windows x86-64 (`x86_64-pc-windows-msvc`). UI: the existing React build in
WebView2 (ADR-001). Privileged side: the Rust core in `desktop/` (see `PARITY.md`).

## Layout

| Path                           | What                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `desktop/crates/campus-core`   | vault: path safety, repository, sessions/roots, errors, collation                                          |
| `desktop/crates/campus-server` | `/__campus/vault` API, catalog/static, token injection; `campus-serve` loopback binary (`--features http`) |
| `desktop/src-tauri`            | Tauri 2 shell, binary `Campus.exe`, NSIS installer                                                         |
| `desktop/scripts/desktop.mjs`  | entry point: `dev`, `build`, `serve`, `check`, `contract`, `first-launch`, `bench`                         |

## How it runs

```text
WebView2 ── campus://localhost/… (origin http://campus.localhost) ──► Campus::respond
                                    ├─ /__campus/vault/*  → Rust Vault API → disk
                                    └─ everything else    → dist/ embedded in Campus.exe
```

- No TCP listener in the desktop app; nothing else on the machine can reach the API.
- **Zero Tauri capabilities** (`app.security.capabilities: []`, `withGlobalTauri: false`):
  the page has no IPC. Its only path to the disk is the Vault API, confined to the
  allowed roots — the user's home, or `CAMPUS_VAULT_ALLOWED_ROOTS` (same rules as the dev server).
- The origin never changes between launches, so `localStorage` (recent vaults, theme,
  layout) persists, which is what makes "relaunch reopens the vault" work.
- Local vs Cloud: unchanged React Startup screen. Cloud uses the `VITE_SUPABASE_*`
  values the frontend was built with (`--env-file`).

## Commands

```bash
node desktop/scripts/desktop.mjs dev   [--env-file ../campus-poc/.env]   # build web once + run debug shell
node desktop/scripts/desktop.mjs build [--env-file ../campus-poc/.env]   # release Campus.exe + NSIS installer
node desktop/scripts/desktop.mjs serve        # http://127.0.0.1:4815 — same server for a browser
node desktop/scripts/desktop.mjs check        # cargo fmt --check, clippy -D warnings, tests
node desktop/scripts/desktop.mjs contract     # Node vs Rust Vault API diff
node desktop/scripts/desktop.mjs first-launch [--exe <path>]   # runtime journey
node desktop/scripts/desktop.mjs bench        # startup timing
```

`--env-file` loads only `VITE_*` keys and never prints them. The frontend build
regenerates `src/routeTree.gen.ts`; the script restores it when it was clean before.

## Toolchain without Visual Studio (how this machine builds)

No admin rights and no VS Build Tools were available, so:

| Piece                                                 | Source                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Rust 1.99.1 stable, host `x86_64-pc-windows-msvc`     | rustup, user-level                                                                                                           |
| MSVC CRT + Windows SDK import libs/headers            | `xwin 0.10.0 splat --use-winsysroot-style --disable-symlinks` (accepts the Microsoft license) into `~/.campus-t2-tools/xwin` |
| Linker                                                | `rust-lld` (ships with Rust)                                                                                                 |
| C/C++ (`webview2-com-sys`), resources (icon/manifest) | LLVM 23.1.4 via scoop: `clang-cl`, `llvm-lib`, `llvm-rc`                                                                     |

`desktop.mjs` uses this automatically when `cl.exe` is not on PATH; with a VS developer
shell it uses MSVC as usual.

## Results on this machine (2026-10-30, Windows 11 Pro 10.0.26200, WebView2 156.0.4314.50)

### Verification levels — reported separately

| Level              | Status                                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CONFIGURED         | yes                                       | `desktop/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, committed                                                                                                                                                                                                                                                                                                                                  |
| BUILT              | yes                                       | `pnpm dlx @tauri-apps/cli@2 build --ci` → `Finished release in 3m 05s`; `Campus.exe` 5,482,496 B, sha256 `d6e6d2fbe1c260ecc91c3c9c67097cf74e97626fb543e2e0c09304956b96f02d`; `Campus_0.1.0_x64-setup.exe` 2,610,014 B, sha256 `2d049ef1ab3db75ef6b57e8d485934a201d25f404d0bdd2efac2e7df84c21570`                                                                                                      |
| RUNTIME_VERIFIED   | yes (release `target/release/Campus.exe`) | `first-launch.mjs` 10/10, evidence `%LOCALAPPDATA%\Temp\campus-desktop-qa\release-run`                                                                                                                                                                                                                                                                                                                |
| INSTALLER_VERIFIED | yes (per-user NSIS, silent)               | `setup.exe /S` exit 0 → `%LOCALAPPDATA%\Campus\Campus.exe` (sha256 `d38083ed66156b0f288132769ed72bf815599aa2c2ddf56ac92de33db6864569`, same size as the build output; the bundler re-patches the exe it packs), HKCU uninstall key + Start Menu shortcut; `first-launch.mjs --exe %LOCALAPPDATA%\Campus\Campus.exe` 10/10 (`installed-run`); `uninstall.exe /S` exit 0, folder, key and shortcut gone |

`first-launch.mjs` journey (fresh WebView2 profile, QA home as the only allowed root):
campus:// origin loads · Startup offers Local **and** Cloud · "Usar esta carpeta" creates
`Documents\Campus` · onboarding renders the bundled catalog offline · choosing
UTN › FRRO › ISI › Plan 2023 writes `.campus/academic/context.json` (`schemaVersion: 1`,
web-app format) · reload keeps the vault · zero failed requests · quit + relaunch reopens
the same vault on `/today`.

### Size

| Artefact                                                                        | Bytes               |
| ------------------------------------------------------------------------------- | ------------------- |
| `Campus.exe` (release, LTO, stripped, frontend embedded)                        | 5,482,496 (5.2 MiB) |
| NSIS installer (WebView2 bootstrapper mode: downloads WebView2 only if missing) | 2,610,014 (2.5 MiB) |
| Frontend `dist/` it embeds (uncompressed)                                       | 4.4 MB              |

### Startup (`startup-bench.mjs`, release exe, ms from process start)

|                                          | window created | page load finished               |
| ---------------------------------------- | -------------- | -------------------------------- |
| first launch, brand-new WebView2 profile | 690            | 764                              |
| warm launches (n=5)                      | 493 – 809      | median **581**, min 537, max 873 |

"Page load finished" is WebView2's navigation-complete for `index.html`; the React app
renders right after. Measured while other threads were compiling on the same machine,
so treat it as an upper bound.

### Quality gates

```text
cargo fmt --all --check                                         → clean
cargo clippy --workspace --all-features --all-targets -D warnings → clean
cargo test --workspace --all-features                           → 57 + 33 passed, 0 failed
node desktop/scripts/contract.mjs                               → 75/75 identical
```

## Known risks and limits

- **Smart App Control is ON on this machine.** During the build it refused to let rustc
  load two freshly compiled artefacts (an ICU build script, then a `tauri_macros`
  proc-macro DLL after a profile change; CodeIntegrity events 3033/3077). The release
  `Campus.exe` and the installer were **not** blocked here, but SAC decides per binary by
  reputation, so an **unsigned** build can be blocked on another SAC machine. Reliable
  distribution needs Authenticode signing — a decision for the user (certificate,
  cost, who holds the key). Turning SAC off is irreversible without reinstalling Windows;
  do not advise it.
- Final icon (T2-D01 closed in T6): `desktop/src-tauri/icons` is generated from the approved
  brand favicon (`public/brand/favicon.svg` → `docs/brand/favicon-1024.png` by
  `node scripts/build-brand.mjs`) with `pnpm dlx @tauri-apps/cli@2 icon docs/brand/favicon-1024.png -o <tmp>`;
  only the five files `tauri.conf.json` references (`32x32.png`, `128x128.png`, `128x128@2x.png`,
  `icon.ico`, `icon.png`) are copied in. Re-run both steps if the brand SVG changes.
- CLI (`packages/campus-cli`) and MCP (`packages/campus-mcp`) are not bundled; they keep
  working on Node against the same vault folder.
- Window size/position are not persisted yet (the campus-desktop skill lists it; next
  step is `tauri-plugin-window-state` driven from Rust, which needs no page capability).
- Linux/macOS: not built or verified. Windows only.
