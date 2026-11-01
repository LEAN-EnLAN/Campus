#!/usr/bin/env node
/**
 * Startup time of the built desktop app, measured by the app itself.
 *
 *   node desktop/scripts/startup-bench.mjs [--exe <Campus.exe>] [--runs 6]
 *
 * Each run launches the exe with CAMPUS_STARTUP_TRACE, waits for the shell to
 * log `page_load_finished` (ms since process start, WebView2 navigation
 * complete for index.html), then closes the window gracefully and waits until
 * every WebView2 process of the run's profile has exited, so no run inherits a
 * locked profile. Run 1 uses a brand-new profile (true first launch); the rest
 * reuse it (warm). Isolated: own profile, own allowed root, never the user's.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d)
const EXE = resolve(opt('--exe', 'desktop/target/release/Campus.exe'))
const RUNS = Number(opt('--runs', '6'))
const DIR = join(tmpdir(), `campus-startup-bench-${Date.now()}`)
mkdirSync(join(DIR, 'home'), { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const webviewProcesses = () => {
  const r = spawnSync('powershell', [
    '-NoProfile',
    '-c',
    `@(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | ? { $_.CommandLine -like '*${DIR.split('\\').pop()}*' }).Count`,
  ])
  return Number(String(r.stdout).trim() || '0')
}

const rows = []
for (let i = 1; i <= RUNS; i += 1) {
  const trace = join(DIR, `trace-${i}.txt`)
  const child = spawn(EXE, [], {
    env: {
      ...process.env,
      CAMPUS_VAULT_ALLOWED_ROOTS: join(DIR, 'home'),
      CAMPUS_STARTUP_TRACE: trace,
      WEBVIEW2_USER_DATA_FOLDER: join(DIR, 'profile'),
    },
    stdio: 'ignore',
  })
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline && !(existsSync(trace) && readFileSync(trace, 'utf8').includes('page_load_finished')))
    await sleep(50)
  await sleep(500)
  // WM_CLOSE first (graceful), then force if needed.
  spawnSync('taskkill', ['/PID', String(child.pid)])
  for (let t = 0; t < 40 && child.exitCode === null; t += 1) await sleep(100)
  if (child.exitCode === null) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'])
  for (let t = 0; t < 60 && webviewProcesses() > 0; t += 1) await sleep(250)

  const lines = existsSync(trace) ? readFileSync(trace, 'utf8').trim().split(/\r?\n/) : []
  const get = (e) => Number(lines.find((l) => l.startsWith(e))?.split(' ')[1] ?? NaN)
  const row = { run: i, profile: i === 1 ? 'new' : 'warm', window_ms: get('window_created'), page_ms: get('page_load_finished') }
  rows.push(row)
  console.log(JSON.stringify(row))
}
const warm = rows.filter((r) => r.profile === 'warm' && Number.isFinite(r.page_ms)).map((r) => r.page_ms).sort((a, b) => a - b)
const median = warm.length ? warm[Math.floor(warm.length / 2)] : NaN
console.log(`\nfirst launch (new profile): ${rows[0]?.page_ms} ms to page load`)
console.log(`warm launches: median ${median} ms, min ${warm[0]} ms, max ${warm.at(-1)} ms (n=${warm.length})`)
