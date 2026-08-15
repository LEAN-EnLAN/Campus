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

const BASE = process.env.CAMPUS_BASE_URL ?? 'http://localhost:5173'
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

  const browser = await chromium.launch({ headless: process.env.CAMPUS_HEADED !== '1' })
  const context = await browser.newContext()
  const page = await context.newPage()

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
  await picker.waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {})

  const leftPicker = !(await picker.isVisible().catch(() => false))
  check('the app mounted after choosing a vault', leftPicker, page.url().replace(BASE, ''))
  // Onboarding is the correct destination for a fresh vault: the picker chooses
  // WHERE to work, and choosing a carrera is a different act that owns its own
  // screen. Reaching it proves the local backend answered `context() === null`.
  const onboarding = await page
    .getByText('Contanos dónde estudiás')
    .isVisible()
    .catch(() => false)
  check('a fresh vault lands on onboarding, not login', onboarding)
  const institutions = await page.getByText('Universidad Tecnológica Nacional').isVisible()
  check('the portable catalog was read with no Supabase', institutions)

  // --- the vault is device-remembered, and reload reopens it ---------------
  await page.reload({ waitUntil: 'domcontentloaded' })
  await picker.waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {})
  const stillIn = !(await picker.isVisible().catch(() => false))
  check('reload reopens the same vault without asking again', stillIn)

  // --- persistence: the files, on disk --------------------------------------
  // Nothing has been authored yet, so nothing should have been written. A
  // picker that created `.campus` on open would be persisting domain state.
  check('opening a vault wrote NOTHING on its own', !existsSync(join(VAULT, '.campus')))

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

  check(
    'no console errors from our own origin',
    consoleErrors.length === 0,
    consoleErrors.slice(0, 2).join(' | '),
  )

  await browser.close()

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
  if (items) console.log(`\nitems.json schemaVersion=${items.schemaVersion} items=${items.items?.length ?? 0}`)

  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${results.length - failed}/${results.length}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('journey crashed:', error)
  process.exit(1)
})
