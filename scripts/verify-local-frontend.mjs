#!/usr/bin/env node
/**
 * P1-08 — the new runtime surfaces, swept.
 *
 * The existing `verify:frontend` drives CLOUD scenarios through tester
 * accounts. LOCAL surfaces need a vault and device config instead, so they get
 * their own sweep rather than a retrofit that would make both harder to read.
 *
 * Same five viewports, same axe tags, same zero-violation bar.
 */
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import AxeBuilder from '@axe-core/playwright'
import { chromium } from '@playwright/test'

import { startDevServer, waitForPortFree } from './lib/dev-server.mjs'

const WORK = '/tmp/campus-local-frontend'
const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
]
const A11Y_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

let checks = 0
let failures = 0
const axeTotals = { critical: 0, serious: 0, moderate: 0, minor: 0 }
const fail = (msg) => {
  failures += 1
  console.log(`    ✘ ${msg}`)
}

console.log('\nP1-08 — local runtime surfaces')
rmSync(WORK, { recursive: true, force: true })
const vault = join(WORK, 'MiVault')
const utnVault = join(WORK, 'UtnVault')
const unrVault = join(WORK, 'UnrVault')
for (const d of [vault, utnVault, unrVault, join(WORK, 'profile')])
  mkdirSync(d, { recursive: true })

await waitForPortFree(5173)
const server = await startDevServer({
  args: ['dev'],
  env: { VITE_SUPABASE_URL: 'http://127.0.0.1:1', VITE_SUPABASE_ANON_KEY: 'offline' },
})
if (!server.ready) {
  console.error('dev server did not start:', server.output.slice(-500))
  process.exit(1)
}

const browser = await chromium.launch({ headless: true })

/** Seed a vault by driving onboarding once, then reuse its device config. */
async function seed(vaultPath, cascade) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await page.goto(server.url, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Ruta de la carpeta').fill(vaultPath)
  await page.getByRole('button', { name: 'Abrir', exact: true }).click()
  await page.waitForURL(/onboarding|today/, { timeout: 25_000 })
  for (const label of cascade) {
    const el = page.getByText(label, { exact: false }).first()
    await el.waitFor({ state: 'visible', timeout: 20_000 })
    await el.click()
    await page.waitForTimeout(400)
  }
  await page
    .getByRole('button', { name: /Listo|empezar/i })
    .first()
    .click()
    .catch(() => {})
  await page.waitForURL(/today/, { timeout: 25_000 }).catch(() => {})
  const storage = await ctx.storageState()
  await ctx.close()
  return storage
}

const utnState = await seed(utnVault, [
  'Universidad Tecnológica Nacional',
  'Facultad Regional Rosario',
  'Ingeniería en Sistemas',
  'Plan 2023',
])
const unrState = await seed(unrVault, [
  'Universidad Nacional de Rosario',
  'Ciencias Exactas',
  'Licenciatura en Ciencias de la Computación',
  'TO 2024',
])

const SURFACES = [
  { name: 'startup-picker', path: '/', state: null, expect: 'Ruta de la carpeta' },
  { name: 'vault-workspace', path: '/vault', state: utnState, expect: 'Nota de hoy' },
  { name: 'local-utn-today', path: '/today', state: utnState },
  { name: 'local-utn-plan', path: '/plan', state: utnState },
  {
    name: 'local-unr-plan',
    path: '/plan',
    state: unrState,
    expect: 'no publicó las correlatividades',
  },
  { name: 'local-unr-today', path: '/today', state: unrState },
]

for (const surface of SURFACES) {
  console.log(`\n  ${surface.name}`)
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      storageState: surface.state ?? undefined,
    })
    const page = await ctx.newPage()
    await page.goto(`${server.url}${surface.path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    checks += 1

    if (surface.expect) {
      const seen = await page
        .getByText(surface.expect)
        .first()
        .isVisible()
        .catch(() => false)
      if (!seen) fail(`${vp.name}: expected copy missing — ${surface.expect}`)
    }

    // No horizontal overflow: a picker or a plan the student cannot read is
    // not a surface, it is a bug with styling.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    if (overflow) fail(`${vp.name}: horizontal overflow`)

    const axe = await new AxeBuilder({ page }).withTags(A11Y_TAGS).analyze()
    for (const v of axe.violations) axeTotals[v.impact ?? 'minor'] += 1
    if (axe.violations.length > 0) {
      fail(
        `${vp.name}: ${axe.violations.length} axe violation(s) — ${axe.violations.map((v) => v.id).join(', ')}`,
      )
    }

    await ctx.close()
  }
  console.log(`    ${VIEWPORTS.length} viewport(s) checked`)
}

await browser.close()
await server.stop()

console.log(
  `\nsurfaces=${SURFACES.length} viewports=${VIEWPORTS.length} checks=${checks}` +
    `\naxe critical=${axeTotals.critical} serious=${axeTotals.serious} moderate=${axeTotals.moderate} minor=${axeTotals.minor}`,
)
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}  ${checks - failures}/${checks}`)
process.exit(failures === 0 ? 0 : 1)
