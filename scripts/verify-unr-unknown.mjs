#!/usr/bin/env node
/**
 * P1-07 — the student SEES that we do not know.
 *
 * Every layer below this is already proven: research provenance → catalog →
 * seed → Postgres → both adapters all carry `prerequisitesKnown: false` with
 * its note. None of that helps if the screen renders an empty prerequisite
 * list as "nothing blocks you", which is the one claim Campus must never make.
 */
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { chromium } from '@playwright/test'

import { startDevServer, waitForPortFree } from './lib/dev-server.mjs'

const WORK = '/tmp/campus-unr'
const VAULT = join(WORK, 'MiVault')
const PROFILE = join(WORK, 'profile')
const results = []
const check = (n, ok, d = '') => {
  results.push(ok)
  console.log(`  ${ok ? '✔' : '✘'} ${n}${d ? ` — ${d}` : ''}`)
}

/** Phrases that would be a LIE about a plan whose correlativas nobody published. */
const FORBIDDEN = [
  'No te falta ninguna correlativa',
  'Sin correlativas',
  'no tiene correlativas',
  'Todas las materias están habilitadas',
]

console.log('\nP1-07 — UNR: unknown prerequisites, as the student sees them')
rmSync(WORK, { recursive: true, force: true })
mkdirSync(VAULT, { recursive: true })
mkdirSync(PROFILE, { recursive: true })

await waitForPortFree(5173)
const server = await startDevServer({
  args: ['dev'],
  env: { VITE_SUPABASE_URL: 'http://127.0.0.1:1', VITE_SUPABASE_ANON_KEY: 'offline' },
})
if (!server.ready) {
  console.error('dev server did not start:', server.output.slice(-500))
  process.exit(1)
}

const browser = await chromium.launchPersistentContext(PROFILE, { headless: true })
const page = browser.pages()[0] ?? (await browser.newPage())

await page.goto(server.url, { waitUntil: 'domcontentloaded' })
await page.getByLabel('Ruta de la carpeta').fill(VAULT)
await page.getByRole('button', { name: 'Abrir', exact: true }).click()
await page.waitForURL(/onboarding|today/, { timeout: 25_000 })

// UNR FCEIA — Licenciatura en Ciencias de la Computación — TO 2024
const step = async (label) => {
  const el = page.getByText(label, { exact: false }).first()
  await el.waitFor({ state: 'visible', timeout: 20_000 })
  await el.click()
  await page.waitForTimeout(500)
}
await step('Universidad Nacional de Rosario')
await step('Ciencias Exactas')
await step('Licenciatura en Ciencias de la Computación')
await step('TO 2024')
await page
  .getByRole('button', { name: /Listo|empezar/i })
  .first()
  .click()
  .catch(() => {})
await page.waitForURL(/today/, { timeout: 25_000 }).catch(() => {})
check('reached Today on the UNR plan', /today/.test(page.url()))

// ---- Plan ------------------------------------------------------------------
await page.goto(`${server.url}/plan`, { waitUntil: 'domcontentloaded' })
await page.getByText('no publicó las correlatividades').first().waitFor({ timeout: 20_000 })
const planText = await page.locator('main').innerText()
check(
  'Plan says the correlativas were never published',
  /no publicó las correlatividades/.test(planText),
)
check('Plan says Campus will not invent them', /No las inventamos/i.test(planText))
for (const phrase of FORBIDDEN) {
  check(`Plan does NOT claim "${phrase}"`, !planText.includes(phrase))
}

// ---- Course ----------------------------------------------------------------
const subject = page
  .getByRole('link')
  .filter({ hasText: /Álgebra|Análisis|Algoritmos/ })
  .first()
await subject.click()
await page.waitForURL(/courses\//, { timeout: 20_000 })
const courseText = await page.locator('main').innerText()
check(
  'Course says the correlativas are unknown',
  /no publicó las correlatividades|No sabemos qué te piden/.test(courseText),
)
// The product has two correct phrasings for this state — the plan-level
// banner ("No las inventamos.") and the per-subject line ("no lo vamos a
// inventar"). Asserting one sentence would fail on the other, which says
// nothing about whether the student was told the truth.
check(
  'Course says Campus will not invent them',
  /No las inventamos|no lo vamos a inventar/i.test(courseText),
)
for (const phrase of FORBIDDEN) {
  check(`Course does NOT claim "${phrase}"`, !courseText.includes(phrase))
}

// The distinction must survive without colour: the sentence itself carries it.
check(
  'the distinction is carried by TEXT, not colour alone',
  /no publicó|No sabemos/.test(courseText),
)

await browser.close()
await server.stop()

const failed = results.filter((r) => !r).length
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${results.length - failed}/${results.length}`)
process.exit(failed === 0 ? 0 : 1)
