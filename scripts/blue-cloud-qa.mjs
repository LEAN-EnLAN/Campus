#!/usr/bin/env node
/**
 * Real Cloud auth E2E with local Supabase + local Mailpit ONLY.
 * No remote SMTP, mock Auth API, shared browser profile or fixed Vite port.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import process from 'node:process'

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')
const vite = join(repo, 'node_modules', 'vite', 'bin', 'vite.js')
const playwright = join(repo, 'node_modules', '@playwright', 'test', 'cli.js')
const unique = randomBytes(10).toString('hex')
const artifacts = resolve(
  process.env.CAMPUS_BLUE_CLOUD_OUTPUT ??
    join(tmpdir(), 'campus-blue-cloud-qa', Date.now() + '-' + process.pid),
)
const email = `campus-qa-${unique}@example.test`
const password = 'Qa!' + randomBytes(18).toString('base64url')
const nextPassword = 'Qa!' + randomBytes(18).toString('base64url')
let server
let exitCode = 1
let admin
let apiUrl

function envFromStatus() {
  // Use ONLY this project's running local Supabase; never load remote env vars.
  // CLI stdout is kept entirely in this Node process and never printed/logged.
  const command =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'pnpm exec supabase status -o env'], {
          cwd: repo,
          encoding: 'utf8',
          timeout: 20000,
          windowsHide: true,
        })
      : spawnSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
          cwd: repo,
          encoding: 'utf8',
          timeout: 20000,
        })
  if (command.status !== 0)
    throw new Error('Local Supabase is not running: pnpm exec supabase status')
  const found = Object.fromEntries(
    (command.stdout ?? '')
      .split(/\r?\n/)
      .map((line) => {
        const match = /^([A-Z_]+)=(.*)$/.exec(line.trim())
        return match ? [match[1], match[2].replace(/^"|"$/g, '')] : [null, null]
      })
      .filter(([key]) => key),
  )
  if (
    found.API_URL !== 'http://127.0.0.1:54321' ||
    found.MAILPIT_URL !== 'http://127.0.0.1:54324'
  )
    throw new Error('Refusing nonlocal Supabase/Mailpit. Expected loopback 54321 and 54324.')
  if (!found.ANON_KEY || !found.SERVICE_ROLE_KEY)
    throw new Error('Missing local Supabase keys.')
  return found
}

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const socket = createServer()
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address()
      socket.close(() => resolvePort(address.port))
    })
  })
}

async function ready(url, child, logs) {
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Isolated Vite exited: ' + logs().slice(-1100))
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1200) })
      if (r.ok && (await r.text()).includes('id="root"')) return
    } catch {
      /* next attempt */
    }
    await new Promise((done) => setTimeout(done, 350))
  }
  throw new Error('Vite readiness timeout: ' + logs().slice(-1100))
}

async function stopOwnVite(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32')
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      timeout: 8000,
    })
  else child.kill('SIGTERM')
}

async function cleanupUser(emailToRemove) {
  // Never delete arbitrary users: exact cryptographically unique email created
  // by this script, from this run, with a fixed test-only prefix and .test TLD.
  if (
    !admin ||
    !emailToRemove.startsWith('campus-qa-') ||
    !emailToRemove.endsWith('@example.test')
  )
    return
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const matches = data.users.filter((user) => user.email === emailToRemove)
    for (const user of matches) {
      const { error: removeError } = await admin.auth.admin.deleteUser(user.id)
      if (removeError) throw removeError
      console.log('Deleted disposable local Supabase fixture account.')
    }
    if (data.users.length < 200) return
  }
  throw new Error('Account cleanup not verified; 20 pages scanned without exhausting users.')
}

try {
  if (!existsSync(vite) || !existsSync(playwright)) throw new Error('Run pnpm install first.')
  require.resolve('@dayflow/core/dist/styles.components.css')
  const keys = envFromStatus()
  apiUrl = keys.API_URL
  const checks = await Promise.all([
    fetch(apiUrl + '/auth/v1/health', { signal: AbortSignal.timeout(5000) }),
    fetch(keys.MAILPIT_URL + '/api/v1/messages', { signal: AbortSignal.timeout(5000) }),
  ])
  if (checks.some((check) => !check.ok))
    throw new Error('Supabase Auth and Mailpit must be running locally.')
  admin = createClient(apiUrl, keys.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  mkdirSync(artifacts, { recursive: true })
  const port = await freePort()
  const base = `http://127.0.0.1:${port}`
  const env = {
    ...process.env,
    VITE_SUPABASE_URL: apiUrl,
    VITE_SUPABASE_ANON_KEY: keys.ANON_KEY,
    VITE_CAMPUS_VAULT: 'off',
    VITE_CAMPUS_TESTER: 'off',
    CAMPUS_VAULT_API: 'off',
    CAMPUS_BLUE_BASE_URL: base,
    CAMPUS_BLUE_CLOUD_OUTPUT: artifacts,
    CAMPUS_BLUE_CLOUD_MAILPIT: keys.MAILPIT_URL,
    CAMPUS_BLUE_CLOUD_EMAIL: email,
    CAMPUS_BLUE_CLOUD_PASSWORD: password,
    CAMPUS_BLUE_CLOUD_NEXT_PASSWORD: nextPassword,
  }
  // Never inherit credentials/proxy/TLS for an unrelated remote environment.
  for (const key of [
    'SUPABASE_SERVICE_ROLE_KEY',
    'CAMPUS_SUPABASE_TARGET',
    'CAMPUS_TLS_CERT',
    'CAMPUS_TLS_KEY',
    'CAMPUS_HMR_HOST',
    'CAMPUS_VAULT_ALLOWED_ORIGINS',
    'CAMPUS_VAULT_ALLOWED_ROOTS',
  ])
    delete env[key]
  const logs = []
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
  server.stdout.on('data', (chunk) => logs.push(chunk.toString()))
  server.stderr.on('data', (chunk) => logs.push(chunk.toString()))
  console.log('Cloud QA against local Supabase+Mailpit, ephemeral Vite: ' + base)
  console.log('Evidence (outside Git): ' + artifacts)
  await ready(base, server, () => logs.join(''))
  const runner = spawn(
    process.execPath,
    [
      playwright,
      'test',
      '--config',
      'tests/e2e-blue/cloud.config.mjs',
      ...process.argv.slice(2),
    ],
    {
      cwd: repo,
      env,
      windowsHide: true,
      stdio: 'inherit',
    },
  )
  exitCode = await new Promise((done, reject) => {
    runner.once('error', reject)
    runner.once('close', (code, signal) => done(signal ? 1 : (code ?? 1)))
  })
} catch (error) {
  console.error('Cloud QA:', error instanceof Error ? error.message : String(error))
  exitCode = 1
} finally {
  await stopOwnVite(server)
  try {
    await cleanupUser(email)
  } catch (error) {
    console.error(
      'Local disposable account cleanup FAILED:',
      error instanceof Error ? error.message : String(error),
    )
    exitCode = 1
  }
  console.log('QA evidence retained at ' + artifacts)
  process.exitCode = exitCode
}
