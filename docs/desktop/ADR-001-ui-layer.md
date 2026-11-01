# ADR-001 — Desktop UI layer for Windows

- Status: **Accepted** (2026-10-30, user decision relayed by the coordinator on the board under "Decisions")
- Decision: **(a) Tauri 2 shell hosting the existing React build in WebView2, talking to the Rust core.** No native Rust UI rewrite.
- Owner: T2 (desktop/**)

## Context

The desktop must be 1:1 with every main Local-mode feature of the dev server, on
Windows x86-64, and work on first launch. Phase 0 (`PARITY.md`) established
that in LOCAL mode the React app already runs `LocalBackend` **inside the
page**; the privileged side is only the vault HTTP API, catalog serving and the
token injected into `index.html`. Phase 1 ported exactly that side to Rust and
proved it identical (75/75 responses against the real `src/server/vault-api.ts`).

## What a UI rewrite would have to cover (measured in this repo, f75b81b)

| Measure | Value | Command |
|---|---|---|
| Route files (screens) | 15 (`today`, `calendar`, `courses` list + detail, `library`, `plan`, `plan/progress`, `settings`, `vault`, `onboarding`, `login`, `dev`, index, layouts) | `find src/routes -name '*.tsx' \| grep -v test` |
| Feature/component files | 39 `.tsx` under `src/components` + `src/features` | `find src/components src/features -name '*.tsx'` |
| Non-test TS/TSX lines | 22,901 | `cat` of every non-test `.ts`/`.tsx` under `src/` |
| Editor | CodeMirror 6 (8 `@codemirror/*` packages), Markdown, wiki links | `package.json` |
| Cloud mode | Supabase Auth + Postgres client (`@supabase/supabase-js`) | `src/lib/supabase.ts` |

## Options compared

| Criterion | (a) Tauri 2 + existing React | (b) Native Rust UI (egui / Slint / iced) |
|---|---|---|
| Parity risk | **None by construction**: the same bundle the dev server serves; only the privileged side changes, and it is contract-tested | Every screen, dialog, drag & drop, clipboard paste, a11y behaviour and the CodeMirror editor re-implemented; parity becomes a manual audit of 15 screens |
| Effort | Shell + custom protocol + packaging: days | Rewrite of ~23k lines of UI/domain TS plus a Markdown editor: months |
| Local vs Cloud | Same Startup screen and `CampusBackend` seam; Cloud keeps Supabase JS | Cloud needs a Rust Supabase/Auth client and RLS-aware data layer from scratch |
| Accessibility | WebView2 = Chromium a11y tree; the existing axe WCAG 2.1 AA checks still apply to the same DOM | egui has partial AccessKit support; every a11y fix redone |
| Startup | WebView2 cold start (measured in `docs/desktop/BUILD.md`) | Typically faster to first frame |
| Binary size | Small exe (WebView2 is the OS runtime on Windows 11) — measured in `docs/desktop/BUILD.md` | Small exe, but no browser engine to reuse for Markdown/HTML rendering |
| Maintenance | One UI codebase for web and desktop | Two UI codebases that drift |
| Security surface | Zero Tauri capabilities; vault confinement enforced in Rust behind a custom protocol (no TCP listener) | Same Rust core; no web surface |

## Decision

(a). It is the only option that is 1:1 with today's features by construction and
deliverable for the presentation. (b) trades a modest startup gain for a full
rewrite and a permanent parity risk.

## Consequences

- `desktop/src-tauri` hosts the built `dist/` through the custom protocol
  `campus://` (WebView2 origin `http://campus.localhost`): a stable origin, so
  `localStorage` (recent vaults, theme, layout) survives restarts, and no port
  that other local processes could reach.
- No change to `src/**` is required: the Rust side reproduces the same
  `/__campus/vault/*` contract and injects `window.__CAMPUS_VAULT_TOKEN__`.
- Tauri capabilities: **none granted**. The page needs no IPC; folder choice
  goes through the existing `/dirs` browser, confined to the allowed roots.
- Windows Smart App Control (ON on the build machine) can block unsigned
  executables; distribution to such machines needs code signing — a decision
  outside this ADR (see `BUILD.md`).
