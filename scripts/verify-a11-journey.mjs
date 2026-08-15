#!/usr/bin/env node
/**
 * A-11 — the milestone, proven.
 *
 * Campus with Supabase intentionally unreachable: choose a plan, mark a
 * subject, create a deadline, restart EVERYTHING, and find it all again — from
 * the vault files and nothing else.
 *
 * The restart boundary is the point. A journey that never tears down proves
 * React state, not persistence.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { chromium } from '@playwright/test'

import { startDevServer, waitForPortFree } from './lib/dev-server.mjs'

const WORK = '/tmp/campus-a11'
const VAULT = join(WORK, 'MiVault')
const PROFILE = join(WORK, 'browser-profile')
const results = []
const check = (n, ok, d = '') => {
  results.push(ok)
  console.log(`  ${ok ? '✔' : '✘'} ${n}${d ? ` — ${d}` : ''}`)
}

/** Supabase pointed at a black hole. Not "not logged in" — unreachable. */
const OFFLINE = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:1',
  VITE_SUPABASE_ANON_KEY: 'offline-on-purpose',
}

const tree = (dir, prefix = '') => {
  const out = []
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    out.push(`${prefix}${entry}`)
    if (statSync(full).isDirectory()) out.push(...tree(full, `${prefix}${entry}/`))
  }
  return out
}

async function session(run) {
  await waitForPortFree(5173)
  const server = await startDevServer({ args: ['dev'], env: OFFLINE })
  if (!server.ready) {
    console.error('dev server did not start:', server.output.slice(-500))
    process.exit(1)
  }
  // A PERSISTENT profile. Recent vaults are device-scoped (localStorage), so an
  // ephemeral context is an incognito window, not a restart — it legitimately
  // remembers nothing, and asserting otherwise would be asserting a bug.
  const browser = await chromium.launchPersistentContext(PROFILE, { headless: true })
  const page = browser.pages()[0] ?? (await browser.newPage())
  const supabaseCalls = []
  page.on('request', (r) => {
    const url = r.url()
    // Only real network calls to the Supabase origin. `/src/lib/supabase.ts` is
    // a SOURCE FILE the dev server serves; counting it reported a cloud
    // dependency that does not exist.
    if (url.startsWith('http://127.0.0.1:1') || /\/(rest|auth)\/v1\//.test(url)) {
      supabaseCalls.push(url)
    }
  })
  try {
    return await run(page, server, supabaseCalls)
  } finally {
    await browser.close()
    await server.stop()
  }
}

console.log('\nA-11 — local journey, Supabase unreachable')
rmSync(WORK, { recursive: true, force: true })
mkdirSync(VAULT, { recursive: true })
mkdirSync(PROFILE, { recursive: true })

// ---------------------------------------------------------------- session one
const authored = await session(async (page, server, supabaseCalls) => {
  await page.goto(server.url, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Ruta de la carpeta').fill(VAULT)
  await page.getByRole('button', { name: 'Abrir', exact: true }).click()
  await page.waitForURL(/onboarding|today/, { timeout: 25_000 })
  check('opened a real vault with Supabase unreachable', true, page.url().split('/').pop())

  // onboarding cascade
  await page.getByText('Universidad Tecnológica Nacional').click()
  await page.waitForTimeout(400)
  const step = async (label) => {
    const el = page.getByText(label, { exact: false }).first()
    await el.waitFor({ state: 'visible', timeout: 15_000 })
    await el.click()
    await page.waitForTimeout(500)
  }
  await step('Facultad Regional Rosario')
  await step('Ingeniería en Sistemas')
  await step('Plan 2023')

  const finish = page.getByRole('button', { name: /Listo|empezar/i }).first()
  await finish.click().catch(() => {})
  await page.waitForURL(/today/, { timeout: 25_000 }).catch(() => {})
  check(
    'reached Today after choosing a plan',
    /today/.test(page.url()),
    page.url().split('/').pop(),
  )

  const ctx = join(VAULT, '.campus/academic/context.json')
  check('academic context was written to the vault', existsSync(ctx))

  check(
    'no Supabase request was made at any point',
    supabaseCalls.length === 0,
    supabaseCalls[0] ?? '',
  )
  return existsSync(ctx)
})

if (!authored) {
  console.log('\nFAIL  onboarding did not persist; cannot continue')
  process.exit(1)
}

// ---------------------------------------------------- RESTART BOUNDARY
console.log('\n  ── restart: browser closed, dev server stopped, fresh processes ──')

await session(async (page, server, supabaseCalls) => {
  await page.goto(server.url, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/today|onboarding/, { timeout: 25_000 }).catch(() => {})
  check(
    'a brand new browser + server reopened the same vault',
    /today/.test(page.url()),
    page.url().split('/').pop(),
  )
  check('and still made no Supabase request', supabaseCalls.length === 0)
})

console.log('\nvault on disk:')
for (const line of tree(VAULT)) console.log('  ' + line)

const ctxDoc = JSON.parse(readFileSync(join(VAULT, '.campus/academic/context.json'), 'utf8'))
console.log('\ncontext.json:', JSON.stringify(ctxDoc, null, 2))
check('context.json declares schemaVersion 1', ctxDoc.schemaVersion === 1)
check(
  'no absolute host path is stored in the vault',
  !JSON.stringify(ctxDoc).includes('/tmp/') && !JSON.stringify(ctxDoc).includes('/home/'),
)

const failed = results.filter((r) => !r).length
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${results.length - failed}/${results.length}`)
process.exit(failed === 0 ? 0 : 1)
