#!/usr/bin/env node
/**
 * Isolated, real-Vault E2E runner. No Supabase process, no fake HTTP handlers.
 * All files it creates are temporary, and only its own Vite PID is stopped.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { createRequire } from 'node:module'

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const vite = join(repo, 'node_modules', 'vite', 'bin', 'vite.js')
const cli = join(repo, 'node_modules', '@playwright', 'test', 'cli.js')
const runName =
  new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-') + '-' + process.pid
const artifacts = resolve(
  process.env.DESIGN_SHOTS_OUT ?? join(tmpdir(), 'campus-design-shots', runName),
)
const fixtureRoot = mkdtempSync(join(tmpdir(), 'campus-blue-local-'))
const env = {
  ...process.env,
  // Offline Local is NOT Cloud. The SDK needs defined values but no server.
  VITE_SUPABASE_URL: 'http://127.0.0.1:1',
  VITE_SUPABASE_ANON_KEY: 'blue-local-offline-fixture',
  VITE_CAMPUS_VAULT: 'on',
  VITE_CAMPUS_TESTER: 'off',
  CAMPUS_VAULT_API: 'on',
  // The server may read/write ONLY the test folder: never the user's home.
  CAMPUS_VAULT_ALLOWED_ROOTS: fixtureRoot,
  CAMPUS_BLUE_VAULT_ROOT: fixtureRoot,
  DESIGN_SHOTS_OUT: artifacts,
  CAMPUS_BLUE_QA_HEADLESS: process.env.CAMPUS_BLUE_QA_HEADLESS ?? '1',
}
// Avoid inheriting alternate proxy/TLS origin settings from an interactive session.
for (const key of [
  'CAMPUS_SUPABASE_TARGET',
  'CAMPUS_TLS_CERT',
  'CAMPUS_TLS_KEY',
  'CAMPUS_HMR_HOST',
  'CAMPUS_VAULT_ALLOWED_ORIGINS',
])
  delete env[key]

function findUnusedPort() {
  return new Promise((done, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : null
      server.close(() => (port ? done(port) : reject(new Error('Could not allocate a port'))))
    })
  })
}

async function ready(url, child, output) {
  const until = Date.now() + 35_000
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error('Vite exited early: ' + output().slice(-3000))
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 1200)
      try {
        const response = await fetch(url, { signal: controller.signal })
        const html = await response.text()
        if (response.ok && html.includes('__CAMPUS_VAULT_TOKEN__')) return
      } finally {
        clearTimeout(timeout)
      }
    } catch {
      /* startup in progress */
    }
    await new Promise((done) => setTimeout(done, 300))
  }
  throw new Error('Isolated Vite did not become ready: ' + output().slice(-3000))
}

async function stopOwnProcess(child) {
  if (!child || child.exitCode !== null) return
  // On Windows stop only the PID that we spawned and its descendants.
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      timeout: 7000,
    })
  } else {
    child.kill('SIGTERM')
  }
}

let server
try {
  if (!existsSync(vite)) throw new Error('Missing Vite. Run pnpm install first.')
  if (!existsSync(cli)) throw new Error('Missing Playwright. Run pnpm install first.')
  // Fail before launching a browser against Vite's red error overlay.
  try {
    require.resolve('@dayflow/core/dist/styles.components.css', { paths: [repo] })
  } catch {
    throw new Error(
      'Preflight: @dayflow/core/dist/styles.components.css is unavailable. Repair the @dayflow dependency installation outside this QA-only scope; Vite would render an error overlay instead of Campus.',
    )
  }
  mkdirSync(artifacts, { recursive: true })
  const port = await findUnusedPort()
  const url = `http://127.0.0.1:${port}`
  env.CAMPUS_BLUE_BASE_URL = url
  const output = []
  server = spawn(
    process.execPath,
    [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: repo,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  server.stdout.on('data', (buffer) => output.push(buffer.toString()))
  server.stderr.on('data', (buffer) => output.push(buffer.toString()))
  console.log('Design screenshots · isolated Vite ' + url)
  console.log('Fixtures: ' + fixtureRoot)
  console.log('Evidence: ' + artifacts)
  await ready(url, server, () => output.join(''))
  const runner = spawn(
    process.execPath,
    [cli, 'test', '--config', 'tests/e2e-design/playwright.config.mjs', ...process.argv.slice(2)],
    {
      cwd: repo,
      env,
      windowsHide: true,
      stdio: 'inherit',
    },
  )
  const exitCode = await new Promise((done, reject) => {
    runner.once('error', reject)
    runner.once('close', (code, signal) => done(signal ? 1 : (code ?? 1)))
  })
  process.exitCode = exitCode
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await stopOwnProcess(server)
  // Never recursively delete user files: fixtureRoot is a freshly created
  // unique temp folder and not configurable via environment.
  rmSync(fixtureRoot, { recursive: true, force: true })
  console.log('QA evidence retained at ' + artifacts)
}
