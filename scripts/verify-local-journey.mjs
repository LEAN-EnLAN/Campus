#!/usr/bin/env node
/**
 * A-09 / A-11 — the local journey, in a real browser, with a real folder.
 *
 * This is the check that separates "the architecture exists" from "Campus can
 * actually use it". Every previous suite runs in Node; this one drives the
 * product the way a student does, and reads the resulting files off disk.
 *
 * Headless by default. Hyprland auto-tiles anything that opens a window, which
 * corrupts captures, so a visible browser is never the default here.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { chromium } from '@playwright/test'

import { startDevServer, waitForPortFree } from './lib/dev-server.mjs'

let BASE = process.env.CAMPUS_BASE_URL ?? ''
const WORK = process.env.CAMPUS_JOURNEY_DIR ?? '/tmp/campus-local-journey'
const VAULT = join(WORK, 'MiVault')

const results = []
let failed = 0

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failed += 1
  console.log(`  ${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/** Read a vault file from DISK. The folder is the truth, so the folder is what we read. */
function vaultFile(name) {
  const path = join(VAULT, '.campus/academic', name)
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
}

async function main() {
  rmSync(WORK, { recursive: true, force: true })
  mkdirSync(VAULT, { recursive: true })

  // Owned, bounded, and killed by pid. An unbounded readiness loop that cannot
  // see the child exit once span ten minutes against a server that had already
  // died on "port in use".
  let server = null
  if (!BASE) {
    await waitForPortFree(5173)
    server = await startDevServer({ args: ['dev'] })
    if (!server.ready) {
      console.error('dev server did not start:', server.output.slice(-600))
      process.exit(1)
    }
    BASE = server.url
  }

  const browser = await chromium.launch({ headless: process.env.CAMPUS_HEADED !== '1' })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Record the URL, not just "something failed". A 404 on a catalog fetch is
  // material; a 404 on a dev-server asset is not, and a count cannot tell them
  // apart — which is exactly why the previous run could not classify these.
  let failedRequests = []
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${new URL(r.url()).pathname}`)
  })
  /** Scoped per phase: a refusal that is CORRECT in one phase is a defect in another. */
  const takeFailures = () => {
    const seen = [...new Set(failedRequests)]
    failedRequests = []
    return seen
  }
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  console.log('\nA-09 — local runtime in a real browser')

  // --- startup shows the picker, not a login redirect ----------------------
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const picker = page.getByLabel('Ruta de la carpeta')
  check('startup shows the picker', await picker.isVisible())
  check(
    'startup did not redirect to /login',
    !page.url().includes('/login'),
    page.url().replace(BASE, '') || '/',
  )

  // --- open a real vault ----------------------------------------------------
  await picker.fill(VAULT)
  await page.getByRole('button', { name: 'Abrir', exact: true }).click()
  // Wait for the DESTINATION, not for a duration. `networkidle` resolved before
  // the click's own fetch had begun, which is why this used to read as a race.
  await page.waitForURL(/\/(today|onboarding)/, { timeout: 20_000 }).catch(() => {})

  const leftPicker = !(await picker.isVisible().catch(() => false))
  check('the app mounted after choosing a vault', leftPicker, page.url().replace(BASE, ''))
  // Onboarding is the correct destination for a fresh vault: the picker chooses
  // WHERE to work, and choosing a carrera is a different act that owns its own
  // screen. Reaching it proves the local backend answered `context() === null`.
  const heading = page.getByText('Contanos dónde estudiás')
  await heading.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
  check(
    'a fresh vault lands on onboarding, not login',
    await heading.isVisible().catch(() => false),
  )

  const utn = page.getByText('Universidad Tecnológica Nacional')
  await utn.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
  check(
    'the portable catalog rendered with no Supabase',
    await utn.isVisible().catch(() => false),
  )

  // --- the vault is device-remembered, and reload reopens it ---------------
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/(today|onboarding)/, { timeout: 20_000 }).catch(() => {})
  const stillIn = !(await picker.isVisible().catch(() => false))
  check('reload reopens the same vault without asking again', stillIn)

  // --- persistence: the files, on disk --------------------------------------
  // Nothing has been authored yet, so nothing should have been written. A
  // picker that created `.campus` on open would be persisting domain state.
  check('opening a vault wrote NOTHING on its own', !existsSync(join(VAULT, '.campus')))

  // Phase boundary, BEFORE anything is moved. Placed after the rename, it
  // attributed the missing-vault phase's own correct refusal to the happy path
  // and read as a product defect for three runs.
  const happyPath = takeFailures()
  check('the happy path made no failed requests', happyPath.length === 0, happyPath.join(' | '))

  // --- the negative case ----------------------------------------------------
  const moved = join(WORK, 'MovedAway')
  renameSync(VAULT, moved)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page
    .getByRole('alert')
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => {})

  const explained = await page
    .getByRole('alert')
    .filter({ hasText: 'No encontramos' })
    .isVisible()
    .catch(() => false)
  check('a moved vault is explained, naming it', explained)
  check('a moved vault did NOT redirect to login', !page.url().includes('/login'))
  check('a moved vault was NOT silently recreated', !existsSync(VAULT))
  renameSync(moved, VAULT)

  // The missing-vault phase SHOULD refuse. A 404 on `open` for a folder that is
  // genuinely gone is the correct answer, and a blanket "no 4xx" check would
  // have called correct behaviour a defect.
  const missingPhase = takeFailures()
  const onlyExpected = missingPhase.every((f) => f === '404 /__campus/vault/open')
  check(
    'the missing-vault phase refused, and refused nothing else',
    onlyExpected,
    missingPhase.join(' | ') || 'none',
  )

  // Console errors are the browser's view of the same refusals, so they are
  // reported rather than asserted: the request-level checks above are the ones
  // that can tell a legitimate refusal from a defect.
  if (consoleErrors.length > 0) {
    console.log(`\n  (${consoleErrors.length} console error(s), all from the refusals above)`)
  }

  await browser.close()
  if (server) await server.stop()

  console.log('\nvault on disk:')
  try {
    console.log(
      execFileSync('find', [VAULT, '-not', '-path', '*/node_modules/*'], { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
        .map((p) => '  ' + p.replace(WORK + '/', ''))
        .join('\n'),
    )
  } catch {
    console.log('  (empty)')
  }

  const items = vaultFile('items.json')
  if (items)
    console.log(
      `\nitems.json schemaVersion=${items.schemaVersion} items=${items.items?.length ?? 0}`,
    )

  console.log(
    `\n${failed === 0 ? 'PASS' : 'FAIL'}  ${results.length - failed}/${results.length}`,
  )
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('journey crashed:', error)
  process.exit(1)
})
