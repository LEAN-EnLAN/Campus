#!/usr/bin/env node
/**
 * One entry point for the Windows desktop app.
 *
 *   node desktop/scripts/desktop.mjs <command> [--env-file <path>]
 *
 *   dev           build the React app once, then run the Tauri shell (debug)
 *   build         build the React app, then `tauri build` (release exe + NSIS installer)
 *   serve         run `campus-serve` on http://127.0.0.1:4815 over dist/ (browser twin)
 *   check         cargo fmt --check, clippy -D warnings, tests
 *   contract      Node-vs-Rust Vault API diff (desktop/scripts/contract.mjs)
 *   first-launch  runtime journey on the release exe (desktop/scripts/first-launch.mjs)
 *   bench         startup time over repeated launches (desktop/scripts/startup-bench.mjs)
 *
 * Toolchain: uses MSVC if `cl.exe` is on PATH (a VS developer shell). Otherwise, if an xwin splat
 * exists (CAMPUS_XWIN, default ~/.campus-t2-tools/xwin) it links with rust-lld
 * and compiles C/C++ and resources with LLVM (clang-cl, llvm-rc), so no Visual
 * Studio install or admin rights are needed. See docs/desktop/BUILD.md.
 *
 * `--env-file` loads ONLY `VITE_*` keys for the frontend build (e.g. the Cloud
 * Supabase URL and anon key); values are never printed.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DESKTOP = resolve(HERE, '..')
const REPO = resolve(DESKTOP, '..')
const [command = 'help', ...rest] = process.argv.slice(2)
const opt = (name) => {
  const i = rest.indexOf(name)
  return i >= 0 ? rest[i + 1] : undefined
}

const onPath = (exe) =>
  (process.env.PATH ?? '').split(delimiter).some((d) => d && existsSync(join(d, exe)))

function toolchainEnv() {
  const env = { ...process.env }
  const cargoBin = join(homedir(), '.cargo', 'bin')
  env.PATH = [cargoBin, env.PATH].join(delimiter)
  // cl.exe, not link.exe: Git for Windows ships a coreutils link.exe on PATH.
  if (onPath('cl.exe') || process.platform !== 'win32') return env

  const xwin = process.env.CAMPUS_XWIN ?? join(homedir(), '.campus-t2-tools', 'xwin')
  if (!existsSync(xwin)) {
    console.error(
      `[desktop] no MSVC link.exe on PATH and no xwin splat at ${xwin}. See docs/desktop/BUILD.md.`,
    )
    process.exit(2)
  }
  const msvc = join(xwin, 'VC', 'Tools', 'MSVC')
  const msvcVer = readdirSync(msvc).sort().pop()
  const sdkLib = join(xwin, 'Windows Kits', '10', 'Lib')
  const sdkVer = readdirSync(sdkLib).sort().pop()
  const sdkInc = join(xwin, 'Windows Kits', '10', 'Include', sdkVer)
  env.LIB = [
    join(msvc, msvcVer, 'lib', 'x64'),
    join(sdkLib, sdkVer, 'um', 'x64'),
    join(sdkLib, sdkVer, 'ucrt', 'x64'),
  ].join(';')
  env.INCLUDE = [
    join(msvc, msvcVer, 'include'),
    ...['ucrt', 'um', 'shared', 'winrt', 'cppwinrt'].map((d) => join(sdkInc, d)),
  ].join(';')
  env.CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = 'rust-lld'
  env.CC_x86_64_pc_windows_msvc = 'clang-cl'
  env.CXX_x86_64_pc_windows_msvc = 'clang-cl'
  env.AR_x86_64_pc_windows_msvc = 'llvm-lib'
  env.RC = 'llvm-rc'
  const llvm = process.env.CAMPUS_LLVM_BIN ?? join(homedir(), 'scoop', 'apps', 'llvm', 'current', 'bin')
  env.PATH = [llvm, env.PATH].join(delimiter)
  return env
}

function viteEnv() {
  const file = opt('--env-file')
  if (!file) return {}
  const out = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  console.log(`[desktop] loaded ${Object.keys(out).length} VITE_* keys from --env-file`)
  return out
}

function run(cmd, args, { cwd = REPO, env = process.env } = {}) {
  console.log(`[desktop] $ ${cmd} ${args.join(' ')}`)
  // `pnpm` is a .cmd shim on Windows and needs a shell; nothing else does, and
  // a shell would split paths on spaces.
  const shell = process.platform === 'win32' && cmd === 'pnpm'
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const pnpm = (args, env) => run('pnpm', args, { env: { ...process.env, ...env } })
const cargo = (args, env) => run('cargo', args, { cwd: DESKTOP, env })
const buildFrontend = () => {
  if (rest.includes('--skip-frontend')) return
  // The router plugin rewrites src/routeTree.gen.ts during `vite build`. It is
  // generated, owned by the web app, and must never be committed from here —
  // so it is restored, but only when it was clean before (never discard edits).
  const tree = 'src/routeTree.gen.ts'
  const isDirty = () => spawnSync('git', ['diff', '--quiet', '--', tree], { cwd: REPO }).status === 1
  const wasDirty = isDirty()
  pnpm(['build'], viteEnv())
  if (!wasDirty && isDirty()) {
    spawnSync('git', ['checkout', '--', tree], { cwd: REPO })
    console.log(`[desktop] restored ${tree} (regenerated by vite build)`)
  }
}

switch (command) {
  case 'dev': {
    buildFrontend()
    cargo(['run', '-p', 'campus-desktop'], toolchainEnv())
    break
  }
  case 'build': {
    buildFrontend()
    run('pnpm', ['dlx', '@tauri-apps/cli@2', 'build', '--ci'], {
      cwd: join(DESKTOP, 'src-tauri'),
      env: toolchainEnv(),
    })
    break
  }
  case 'serve': {
    cargo(
      ['run', '--release', '-p', 'campus-server', '--features', 'http', '--bin', 'campus-serve', '--', '--dist', join(REPO, 'dist')],
      toolchainEnv(),
    )
    break
  }
  case 'check': {
    const env = toolchainEnv()
    cargo(['fmt', '--all', '--check'], env)
    cargo(['clippy', '--workspace', '--all-features', '--all-targets', '--', '-D', 'warnings'], env)
    cargo(['test', '--workspace', '--all-features'], env)
    break
  }
  case 'contract': {
    cargo(['build', '-p', 'campus-server', '--features', 'http'], toolchainEnv())
    run('node', [join(HERE, 'contract.mjs'), ...rest])
    break
  }
  case 'first-launch': {
    const args = rest.includes('--exe') ? rest : ['--exe', join(DESKTOP, 'target', 'release', 'Campus.exe'), ...rest]
    run('node', [join(HERE, 'first-launch.mjs'), ...args])
    break
  }
  case 'bench': {
    run('node', [join(HERE, 'startup-bench.mjs'), ...rest])
    break
  }
  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0])
}
