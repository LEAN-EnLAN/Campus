#!/usr/bin/env node
/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  TESTER TOOLING — temporary. Delete with the rest; see docs/TESTING.md.  │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * `pnpm verify:frontend` — every frontend surface, at every viewport, at once.
 *
 * Where `verify:ui` sweeps the six main routes in one populated state, this
 * sweeps EVERY reachable state, including the ones blocked by missing academic
 * data: a brand-new account, a plan Campus does not have, and the UNR plan whose
 * correlativas the university has not published. It also covers the surfaces the
 * main sweep never sees — login, onboarding step by step, per-filter course
 * lists, course detail for a blocked vs. an approved materia, and the two
 * overlays.
 *
 * Every surface is checked for render, runtime console errors, horizontal
 * overflow AND accessibility (axe-core), and screenshotted.
 *
 * Scenarios run in PARALLEL, one browser context each.
 *
 * Never touches the user's compositor: Chromium runs headless by default. Set
 * CAMPUS_HEADED=1 to run headed inside a pinned virtual display —
 * `pnpm verify:frontend:xvfb` does that for you. It refuses to run headed on
 * DISPLAY=:0, because taking over a live Hyprland session is a real failure mode.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import AxeBuilder from '@axe-core/playwright'
import { chromium } from '@playwright/test'

import { computeCandidateId, PREVIEW_URL, startPreview } from './lib/harness.mjs'
import { emailFor, SCENARIOS, TESTER_PASSWORD } from './tester.mjs'

const candidate = computeCandidateId()
const outDir = join('evidence', 'frontend', candidate)
mkdirSync(outDir, { recursive: true })

const HEADED = process.env.CAMPUS_HEADED === '1'
const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800, kind: 'mobile' },
  { name: '390x844', width: 390, height: 844, kind: 'mobile' },
  { name: '768x1024', width: 768, height: 1024, kind: 'tablet' },
  { name: '1280x800', width: 1280, height: 800, kind: 'desktop' },
  { name: '1440x900', width: 1440, height: 900, kind: 'desktop' },
]
const A11Y_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

const IGNORED_CONSOLE = [/favicon/i, /React DevTools/i, /\[vite\]/i]
const isRealError = (text) => !IGNORED_CONSOLE.some((p) => p.test(text))

/**
 * Is this URL ours?
 *
 * Chromium reports a failed subresource as a bare "Failed to load resource: 404"
 * with no URL in the console text, so filtering on the message cannot tell a bug
 * in Campus from Google Fonts having a bad minute. Classify by origin instead:
 * the app and the local database are ours, anything else is the internet.
 */
function isOwnOrigin(url) {
  try {
    const { origin } = new URL(url)
    return origin === new URL(PREVIEW_URL).origin || /127\.0\.0\.1|localhost/.test(origin)
  } catch {
    return true
  }
}

/** Wait until `<main>` has painted something. */
async function settled(page) {
  await page.waitForSelector('main', { timeout: 20_000 })
  await page.waitForFunction(
    () => (document.querySelector('main')?.textContent ?? '').trim().length > 0,
    { timeout: 20_000 },
  )
}

/**
 * Open a materia from the Plan screen by the status label on its row.
 * Waits for the plan to paint first — `waitForURL` resolves before the previous
 * screen unmounts, and the course detail also renders `main ul li a` links.
 */
async function openSubjectByStatus(page, status) {
  await page.goto(`${PREVIEW_URL}/plan`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /1° año/ }).waitFor({ timeout: 20_000 })
  const row = page.locator('main ul li a', { hasText: status }).first()
  await row.waitFor({ timeout: 20_000 })
  await row.click()
  await page.waitForURL(/\/courses\//, { timeout: 20_000 })
  await settled(page)
}

/**
 * The surface matrix. `auth: null` means no session.
 * `expectAlert` marks the surfaces where a `role="alert"` is legitimate content
 * (a validation message we deliberately provoked), so it is not read as a defect.
 */
const SURFACES = [
  // ---- unauthenticated ----
  {
    name: 'login-signup',
    auth: null,
    title: 'Login · crear cuenta',
    go: (page) => page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'networkidle' }),
  },
  {
    name: 'login-signin',
    auth: null,
    title: 'Login · entrar',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Entrá' }).click()
      await page.getByRole('button', { name: 'Entrar' }).waitFor()
    },
  },
  {
    name: 'login-error',
    auth: null,
    title: 'Login · credenciales inválidas',
    expectAlert: true,
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Entrá' }).click()
      await page.getByLabel('Email').fill('no-existe@tester.campus.local')
      await page.getByLabel('Contraseña').fill('incorrecta123')
      await page.getByRole('button', { name: 'Entrar' }).click()
      await page.getByRole('alert').waitFor({ timeout: 20_000 })
    },
  },
  {
    name: 'not-found',
    auth: null,
    title: '404',
    go: (page) => page.goto(`${PREVIEW_URL}/ruta-que-no-existe`, { waitUntil: 'networkidle' }),
  },
  {
    name: 'dev-tools',
    auth: null,
    title: 'Herramientas de tester',
    go: (page) => page.goto(`${PREVIEW_URL}/dev`, { waitUntil: 'networkidle' }),
  },

  // ---- onboarding, step by step (the account with no carrera) ----
  {
    name: 'onboarding-1-universidad',
    auth: 'nuevo',
    title: 'Onboarding · paso 1',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/onboarding`, { waitUntil: 'networkidle' })
      await page.getByRole('radio').first().waitFor({ timeout: 20_000 })
    },
  },
  {
    name: 'onboarding-2-facultad',
    auth: 'nuevo',
    title: 'Onboarding · paso 2',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/onboarding`, { waitUntil: 'networkidle' })
      await page.getByRole('radio', { name: /Universidad Tecnológica Nacional/ }).check()
      await page.getByRole('radio', { name: /Facultad Regional Rosario/ }).waitFor()
    },
  },
  {
    name: 'onboarding-4-plan',
    auth: 'nuevo',
    title: 'Onboarding · paso 4 (plan elegido)',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/onboarding`, { waitUntil: 'networkidle' })
      await page.getByRole('radio', { name: /Universidad Tecnológica Nacional/ }).check()
      await page.getByRole('radio', { name: /Facultad Regional Rosario/ }).check()
      await page.getByRole('radio', { name: /Ingeniería en Sistemas de Información/ }).check()
      await page.getByRole('radio', { name: /Plan 2023/ }).check()
    },
  },
  {
    name: 'onboarding-manual',
    auth: 'nuevo',
    title: 'Onboarding · no encuentro mi carrera',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/onboarding`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'No encuentro mi carrera' }).click()
      await page.getByLabel('¿Qué estudiás?').waitFor()
    },
  },

  // ---- Today ----
  { name: 'today-vacio', auth: 'utn-vacio', title: 'Hoy · sin nada', path: '/today' },
  { name: 'today-poblado', auth: 'utn-activo', title: 'Hoy · con atrasadas', path: '/today' },
  { name: 'today-unmapped', auth: 'unmapped', title: 'Hoy · plan desconocido', path: '/today' },
  { name: 'today-unr', auth: 'unr', title: 'Hoy · UNR', path: '/today' },

  // ---- Plan, including the blocked-data cases ----
  { name: 'plan-utn', auth: 'utn-activo', title: 'Plan · UTN con correlativas', path: '/plan' },
  {
    name: 'plan-unr-sin-correlativas',
    auth: 'unr',
    title: 'Plan · UNR sin correlativas (BLOQUEADO por la fuente)',
    path: '/plan',
  },
  {
    name: 'plan-unmapped',
    auth: 'unmapped',
    title: 'Plan · no tenemos tu plan (CAP-ONBOARD-002)',
    path: '/plan',
  },
  { name: 'plan-avanzado', auth: 'utn-avanzado', title: 'Plan · último año', path: '/plan' },
  { name: 'plan-vacio', auth: 'utn-vacio', title: 'Plan · sin progreso', path: '/plan' },

  // ---- Courses, per filter ----
  {
    name: 'courses-cursando',
    auth: 'utn-activo',
    title: 'Materias · Cursando',
    path: '/courses',
  },
  {
    name: 'courses-disponibles',
    auth: 'utn-activo',
    title: 'Materias · Disponibles',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/courses`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /^Disponibles/ }).click()
    },
  },
  {
    name: 'courses-aprobadas',
    auth: 'utn-activo',
    title: 'Materias · Aprobadas',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/courses`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /^Aprobadas/ }).click()
    },
  },
  {
    name: 'courses-todas',
    auth: 'utn-avanzado',
    title: 'Materias · Todas (con desaprobada y equivalencia)',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/courses`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /^Todas/ }).click()
    },
  },
  {
    name: 'courses-vacio',
    auth: 'utn-vacio',
    title: 'Materias · no estás cursando nada',
    path: '/courses',
  },
  {
    name: 'courses-unmapped',
    auth: 'unmapped',
    title: 'Materias · plan desconocido',
    path: '/courses',
  },

  // ---- Course detail, per status ----
  {
    name: 'course-bloqueada',
    auth: 'utn-vacio',
    title: 'Materia · bloqueada por correlativas',
    go: (page) => openSubjectByStatus(page, 'Bloqueada'),
  },
  {
    name: 'course-cursando',
    auth: 'utn-activo',
    title: 'Materia · cursando, con fechas y material',
    go: (page) => openSubjectByStatus(page, 'Cursando'),
  },
  {
    name: 'course-aprobada',
    auth: 'utn-activo',
    title: 'Materia · aprobada, con lo que habilita',
    go: (page) => openSubjectByStatus(page, 'Aprobada'),
  },
  {
    name: 'course-unr',
    auth: 'unr',
    title: 'Materia · UNR (sin correlativas que mostrar)',
    go: (page) => openSubjectByStatus(page, 'Cursando'),
  },

  // ---- Calendar / Library / Settings ----
  {
    name: 'calendar-vacio',
    auth: 'utn-vacio',
    title: 'Calendario · sin nada',
    path: '/calendar',
  },
  {
    name: 'calendar-poblado',
    auth: 'utn-activo',
    title: 'Calendario · semana con entregas',
    path: '/calendar',
  },
  { name: 'library-vacio', auth: 'utn-vacio', title: 'Material · sin nada', path: '/library' },
  {
    name: 'library-poblado',
    auth: 'utn-activo',
    title: 'Material · links y notas',
    path: '/library',
  },
  {
    name: 'library-nota',
    auth: 'utn-activo',
    title: 'Material · formulario de nota',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/library`, { waitUntil: 'networkidle' })
      await page.getByLabel('Tipo').selectOption('note')
      await page.getByLabel('Nota').waitFor()
    },
  },
  { name: 'settings', auth: 'utn-activo', title: 'Ajustes', path: '/settings' },
  {
    name: 'settings-unmapped',
    auth: 'unmapped',
    title: 'Ajustes · plan desconocido',
    path: '/settings',
  },

  // ---- Overlays ----
  {
    name: 'overlay-quick-capture',
    auth: 'utn-activo',
    title: 'Quick capture',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/today`, { waitUntil: 'networkidle' })
      await settled(page)
      await page.keyboard.press('Control+k')
      await page.getByRole('dialog').waitFor({ timeout: 20_000 })
    },
  },
  {
    name: 'overlay-quick-capture-error',
    auth: 'utn-activo',
    title: 'Quick capture · título vacío',
    expectAlert: true,
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/today`, { waitUntil: 'networkidle' })
      await settled(page)
      await page.keyboard.press('Control+k')
      const dialog = page.getByRole('dialog')
      await dialog.waitFor({ timeout: 20_000 })
      await dialog.getByRole('button', { name: 'Guardar' }).click()
      await dialog.getByText('Poné un título.').waitFor({ timeout: 10_000 })
    },
  },
  {
    name: 'overlay-search-resultados',
    auth: 'utn-activo',
    title: 'Buscar · con resultados',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/today`, { waitUntil: 'networkidle' })
      await settled(page)
      await page.keyboard.press('/')
      const dialog = page.getByRole('dialog')
      await dialog.waitFor({ timeout: 20_000 })
      await dialog.getByRole('combobox').fill('matematico')
      await dialog.getByRole('option').first().waitFor({ timeout: 10_000 })
    },
  },
  {
    name: 'overlay-search-sin-resultados',
    auth: 'utn-activo',
    title: 'Buscar · sin resultados',
    go: async (page) => {
      await page.goto(`${PREVIEW_URL}/today`, { waitUntil: 'networkidle' })
      await settled(page)
      await page.keyboard.press('/')
      const dialog = page.getByRole('dialog')
      await dialog.waitFor({ timeout: 20_000 })
      await dialog.getByRole('combobox').fill('quimica organica industrial')
      await dialog.getByText(/No encontramos nada/).waitFor({ timeout: 10_000 })
    },
  },
]

async function loginAs(page, scenarioKey) {
  await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Entrá' }).click()
  await page.getByLabel('Email').fill(emailFor(scenarioKey))
  await page.getByLabel('Contraseña').fill(TESTER_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  // A scenario with no carrera lands on /onboarding, not /today.
  await page.waitForURL(/\/(today|onboarding)/, { timeout: 30_000 })
}

/** Check one surface at one viewport. */
async function checkSurface(context, surface, viewport) {
  const page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []
  // Record the URL, not just "404": a bare status in a console message is
  // undiagnosable, and this sweep exists to diagnose.
  const networkErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && isRealError(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => pageErrors.push(e.message))
  const externalErrors = []
  const record404 = (entry, url) => {
    if (isOwnOrigin(url)) networkErrors.push(entry)
    else externalErrors.push(entry)
  }
  page.on('response', (r) => {
    if (r.status() >= 400) record404(`${r.status()} ${r.url()}`, r.url())
  })
  page.on('requestfailed', (r) => {
    const text = r.failure()?.errorText ?? 'failed'
    if (!/ERR_ABORTED/.test(text)) record404(`${text} ${r.url()}`, r.url())
  })

  const record = {
    surface: surface.name,
    title: surface.title,
    scenario: surface.auth ?? '(sin sesión)',
    viewport: viewport.name,
    rendered: false,
    overflow: null,
    unexpectedAlert: null,
    a11y: null,
    consoleErrors,
    pageErrors,
    networkErrors,
    externalErrors,
    screenshot: `${surface.name}-${viewport.name}.png`,
    passed: false,
  }

  try {
    if (surface.go) await surface.go(page)
    else await page.goto(`${PREVIEW_URL}${surface.path}`, { waitUntil: 'networkidle' })

    await settled(page)
    record.rendered = true

    record.overflow = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        overflows: doc.scrollWidth > doc.clientWidth + 1,
      }
    })

    // An error banner is a defect unless this surface deliberately provoked one.
    if (!surface.expectAlert) {
      record.unexpectedAlert = await page.evaluate(() => {
        const alert = document.querySelector(
          'main [role="alert"], [role="dialog"] [role="alert"]',
        )
        return alert ? (alert.textContent ?? '').trim().slice(0, 160) : null
      })
    }

    const axe = await new AxeBuilder({ page }).withTags(A11Y_TAGS).analyze()
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
    const violations = axe.violations.map((v) => {
      const impact = v.impact ?? 'minor'
      counts[impact] = (counts[impact] ?? 0) + 1
      return {
        id: v.id,
        impact,
        help: v.help,
        targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      }
    })
    record.a11y = { counts, violations }

    await page.screenshot({ path: join(outDir, record.screenshot), fullPage: false })
  } catch (error) {
    pageErrors.push(error instanceof Error ? error.message : String(error))
  } finally {
    await page.close()
  }

  const blockingA11y = (record.a11y?.counts.critical ?? 0) + (record.a11y?.counts.serious ?? 0)
  // login-error asks Supabase Auth for a rejection on purpose; its 400 and the
  // console line that follows are the expected outcome, not a defect.
  const expectedNetworkNoise = surface.expectAlert === true
  // Drop as many console lines as there were third-party failures: Chromium emits
  // exactly one per failed subresource, and those are not Campus defects.
  const ownConsoleErrors = Math.max(0, consoleErrors.length - externalErrors.length)
  record.ownConsoleErrors = ownConsoleErrors
  record.passed =
    record.rendered &&
    (expectedNetworkNoise || ownConsoleErrors === 0) &&
    pageErrors.length === 0 &&
    record.overflow !== null &&
    !record.overflow.overflows &&
    !record.unexpectedAlert &&
    blockingA11y === 0

  return record
}

const EXPECT_ALERT = new Set(SURFACES.filter((s) => s.expectAlert).map((s) => s.name))
const expectedNetworkNoiseFor = (record) => EXPECT_ALERT.has(record.surface)

/** All surfaces for one auth group, across all viewports. */
async function runGroup(browser, groupKey, surfaces, storageStateFor) {
  const records = []

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      storageState: groupKey === null ? undefined : storageStateFor.get(groupKey),
      locale: 'es-AR',
      timezoneId: 'America/Argentina/Buenos_Aires',
      hasTouch: viewport.kind === 'mobile',
    })

    for (const surface of surfaces) {
      const record = await checkSurface(context, surface, viewport)
      records.push(record)
      const mark = record.passed ? '✔' : '✖'
      const why = record.passed
        ? ''
        : ` ← ${[
            !record.rendered ? 'no render' : null,
            record.overflow?.overflows
              ? `overflow ${record.overflow.scrollWidth}>${record.overflow.clientWidth}`
              : null,
            record.unexpectedAlert ? `alert: "${record.unexpectedAlert}"` : null,
            record.a11y && record.a11y.counts.critical + record.a11y.counts.serious > 0
              ? `a11y c${record.a11y.counts.critical}/s${record.a11y.counts.serious}: ` +
                record.a11y.violations
                  .filter((v) => v.impact === 'critical' || v.impact === 'serious')
                  .map((v) => v.id)
                  .join(',')
              : null,
            !expectedNetworkNoiseFor(record) && record.ownConsoleErrors
              ? `${record.ownConsoleErrors} console: ${record.networkErrors[0] ?? record.consoleErrors[0]?.slice(0, 90)}`
              : null,
            record.pageErrors.length ? record.pageErrors[0]?.slice(0, 90) : null,
          ]
            .filter(Boolean)
            .join(' · ')}`
      console.log(`  ${mark} ${record.surface.padEnd(32)} ${viewport.name.padEnd(9)}${why}`)
    }

    await context.close()
  }

  return records
}

async function main() {
  if (HEADED && (process.env.DISPLAY === ':0' || !process.env.DISPLAY)) {
    console.error(
      '[verify:frontend] refusing to run headed on DISPLAY=' +
        `${process.env.DISPLAY ?? '(unset)'}. That is the live session.\n` +
        'Use `pnpm verify:frontend:xvfb`, which pins a virtual display.',
    )
    process.exit(1)
  }

  let preview = null
  let browser = null
  const records = []

  try {
    preview = await startPreview()
    browser = await chromium.launch({ headless: !HEADED })

    // One login per scenario, reused across every surface and viewport.
    const storageStateFor = new Map()
    const authKeys = [...new Set(SURFACES.map((s) => s.auth).filter(Boolean))]

    await Promise.all(
      authKeys.map(async (key) => {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
        const page = await context.newPage()
        await loginAs(page, key)
        storageStateFor.set(key, await context.storageState())
        await context.close()
      }),
    )

    // Group by auth so each scenario is an independent parallel unit.
    const groups = new Map()
    for (const surface of SURFACES) {
      const key = surface.auth ?? null
      const bucket = groups.get(key)
      if (bucket) bucket.push(surface)
      else groups.set(key, [surface])
    }

    console.log(
      `\n  ${SURFACES.length} superficies × ${VIEWPORTS.length} viewports ` +
        `= ${SURFACES.length * VIEWPORTS.length} chequeos · ` +
        `${groups.size} grupos en paralelo · ${HEADED ? 'headed/xvfb' : 'headless'}\n`,
    )

    const results = await Promise.all(
      [...groups.entries()].map(([key, surfaces]) =>
        runGroup(browser, key, surfaces, storageStateFor),
      ),
    )
    for (const group of results) records.push(...group)
  } finally {
    if (browser) await browser.close()
    preview?.stop()
  }

  const totals = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  for (const record of records) {
    if (!record.a11y) continue
    for (const key of Object.keys(totals)) totals[key] += record.a11y.counts[key] ?? 0
  }

  const failed = records.filter((r) => !r.passed)
  const report = {
    candidate,
    generatedAt: new Date().toISOString(),
    mode: HEADED ? 'headed inside a pinned virtual display' : 'headless (no display used)',
    surfaces: SURFACES.length,
    viewports: VIEWPORTS.map((v) => v.name),
    total: records.length,
    passed: records.length - failed.length,
    failed: failed.length,
    a11yTotals: totals,
    externalResourceFailures: records.reduce((n, r) => n + (r.externalErrors?.length ?? 0), 0),
    scenarios: SCENARIOS.map((s) => ({ key: s.key, title: s.title, covers: s.covers })),
    records,
  }
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))

  console.log(
    `\nverify:frontend  candidate=${candidate}  ${report.passed}/${report.total} chequeos` +
      `  a11y critical=${totals.critical} serious=${totals.serious}` +
      ` moderate=${totals.moderate} minor=${totals.minor}` +
      `\n  → ${outDir}/report.json  (${SURFACES.length} capturas × ${VIEWPORTS.length} viewports)`,
  )

  if (failed.length > 0) {
    console.error(`\nverify:frontend FAILED — ${failed.length} chequeo(s) no pasaron.`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`verify:frontend crashed: ${error.stack ?? error.message}`)
  process.exit(1)
})
