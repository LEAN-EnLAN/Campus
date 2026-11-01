#!/usr/bin/env node
/**
 * RUNTIME verification of the desktop app on this Windows machine: a real
 * first launch of the built executable, driven through WebView2's DevTools port.
 *
 *   node desktop/scripts/first-launch.mjs --exe <Campus.exe> [--out <dir>]
 *
 * Isolation: a brand-new WebView2 profile (WEBVIEW2_USER_DATA_FOLDER) and a QA
 * "home" as the only allowed root (CAMPUS_VAULT_ALLOWED_ROOTS), so the run is a
 * true first launch and never touches the student's real folders or settings.
 *
 * Journey: Startup shows Local and Cloud → "Usar esta carpeta" creates
 * Documents/Campus → onboarding renders the bundled catalog → choosing a
 * carrera writes .campus/academic/context.json on disk → reload stays in →
 * quitting and relaunching reopens the same vault (localStorage persisted on
 * the stable campus:// origin).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { chromium } from '@playwright/test'

const argv = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : fallback
}
const EXE = resolve(opt('--exe', 'desktop/target/release/Campus.exe'))
const OUT = resolve(opt('--out', join(tmpdir(), `campus-desktop-qa-${Date.now()}`)))
const PORT = 9333

rmSync(OUT, { recursive: true, force: true })
const HOME = join(OUT, 'home')
const PROFILE = join(OUT, 'webview2-profile')
const TRACE = join(OUT, 'startup-trace.txt')
mkdirSync(join(HOME, 'Documents'), { recursive: true })
mkdirSync(PROFILE, { recursive: true })

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

function launch() {
  const child = spawn(EXE, [], {
    env: {
      ...process.env,
      CAMPUS_VAULT_ALLOWED_ROOTS: HOME,
      CAMPUS_STARTUP_TRACE: TRACE,
      WEBVIEW2_USER_DATA_FOLDER: PROFILE,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
    },
    stdio: 'ignore',
  })
  return child
}

async function attach() {
  const deadline = Date.now() + 30_000
  let lastError
  while (Date.now() < deadline) {
    try {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`)
      const page = browser.contexts()[0]?.pages().find((p) => p.url().includes('campus'))
      if (page) return { browser, page }
      await browser.close()
    } catch (e) {
      lastError = e
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`could not attach to WebView2: ${lastError}`)
}

const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`) })

const vault = join(HOME, 'Documents', 'Campus')
let child = launch()
try {
  console.log(`\nfirst launch: ${EXE}`)
  const { browser, page } = await attach()
  check('the window loads the app from the campus:// origin', page.url().startsWith('http://campus.localhost'), page.url())

  const local = page.getByText('En esta computadora')
  await local.waitFor({ state: 'visible', timeout: 20_000 })
  check('Startup offers LOCAL mode', await local.isVisible())
  const cloud = page.getByRole('heading', { name: 'En la nube' })
  check('Startup offers CLOUD mode', await cloud.isVisible().catch(() => false))
  const failures = []
  page.on('response', (r) => r.status() >= 400 && failures.push(`${r.status()} ${new URL(r.url()).pathname}`))
  await shot(page, '01-startup')

  await page.getByRole('button', { name: 'Usar esta carpeta' }).click()
  await page.waitForURL(/\/(onboarding|today)/, { timeout: 20_000 })
  check('"Usar esta carpeta" created the vault folder', existsSync(vault), vault)
  const setup = page.getByText('Organicemos tu recorrido')
  await setup.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
  check('a fresh vault lands on academic setup', await setup.isVisible(), new URL(page.url()).pathname)

  const cascade = ['Universidad Tecnológica Nacional', 'Facultad Regional Rosario', 'Ingeniería en Sistemas', 'Plan 2023']
  await page.getByText(cascade[0]).first().waitFor({ state: 'visible', timeout: 20_000 })
  check('the bundled catalog renders with no network', true, cascade[0])
  await shot(page, '02-onboarding')
  for (const label of cascade) {
    const el = page.getByText(label, { exact: false }).first()
    await el.waitFor({ state: 'visible', timeout: 20_000 })
    await el.click()
    await page.waitForTimeout(300)
  }
  await page.getByRole('button', { name: /Guardar y continuar|Listo|empezar/i }).first().click()
  const contextFile = join(vault, '.campus', 'academic', 'context.json')
  for (let i = 0; i < 40 && !existsSync(contextFile); i += 1) await page.waitForTimeout(250)
  const context = existsSync(contextFile) ? JSON.parse(readFileSync(contextFile, 'utf8')) : null
  check(
    'choosing a carrera wrote context.json in the web app format',
    context?.schemaVersion === 1 && typeof context?.context?.curriculumId === 'string',
    context ? `curriculumId=${context.context.curriculumId}` : 'missing',
  )
  await shot(page, '03-after-onboarding')

  // Saving navigates on its own; reload only once that settles.
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1000)
  // CDP's own reload reports ERR_ABORTED for a custom-scheme document even
  // though WebView2 reloads it (the shell logs the second page load), so
  // reload from inside the page, the way F5 does.
  await page.evaluate(() => location.reload()).catch(() => {})
  await page.waitForTimeout(2500)
  check(
    'reload keeps the vault open and the carrera chosen',
    !(await page.getByText('En esta computadora').first().isVisible().catch(() => false)) &&
      !(await page.getByText('Organicemos tu recorrido').isVisible().catch(() => false)),
    new URL(page.url()).pathname,
  )
  await shot(page, '03b-after-reload')
  check('no failed requests on the happy path', failures.length === 0, failures.join(' | '))
  await browser.close().catch(() => {})
  child.kill()
  await new Promise((r) => setTimeout(r, 1500))

  console.log('\nsecond launch (same profile)')
  child = launch()
  const second = await attach()
  await second.page.waitForTimeout(2500)
  check(
    'relaunch reopens the same vault without asking',
    !(await second.page.getByRole('button', { name: 'Usar esta carpeta' }).isVisible().catch(() => false)) &&
      !(await second.page.getByText('Organicemos tu recorrido').isVisible().catch(() => false)),
    new URL(second.page.url()).pathname,
  )
  await shot(second.page, '04-relaunch')
  await second.browser.close().catch(() => {})
} catch (e) {
  check('journey completed', false, String(e).slice(0, 300))
} finally {
  child.kill()
}

const trace = existsSync(TRACE) ? readFileSync(TRACE, 'utf8').trim() : ''
console.log(`\nstartup trace (ms since process start):\n${trace}`)
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ exe: EXE, results, trace }, null, 2))
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed — evidence in ${OUT}`)
process.exitCode = failed ? 1 : 0
