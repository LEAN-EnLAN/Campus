import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.env.CAMPUS_BLUE_VAULT_ROOT
const OUTPUT = process.env.CAMPUS_BLUE_QA_OUTPUT
if (!ROOT || !OUTPUT || !process.env.CAMPUS_BLUE_BASE_URL) {
  throw new Error('Run with node scripts/blue-local-qa.mjs; it isolates real Vault and output.')
}

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1627x928', width: 1627, height: 928 },
]
const ROUTES = [
  { path: '/today', label: 'hoy', heading: 'Hoy' },
  { path: '/plan', label: 'plan', heading: 'Plan académico' },
  { path: '/courses', label: 'materias', heading: 'Materias' },
  { path: '/calendar', label: 'calendario' },
  { path: '/library', label: 'material', heading: 'Material' },
  { path: '/settings', label: 'ajustes', heading: 'Ajustes' },
  { path: '/vault', label: 'vault', landmark: 'Explorador de notas' },
  { path: '/plan/progress', label: 'progreso' },
]

async function snapshot(page, size, name) {
  const folder = join(OUTPUT, 'screenshots', size)
  mkdirSync(folder, { recursive: true })
  await page.screenshot({
    path: join(folder, name + '.png'),
    animations: 'disabled',
    fullPage: false,
  })
}

async function accessible(page, route, size) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const blocking = result.violations.filter((issue) =>
    ['critical', 'serious'].includes(issue.impact),
  )
  const folder = join(OUTPUT, 'axe', size)
  mkdirSync(folder, { recursive: true })
  const impacts = ['critical', 'serious', 'moderate', 'minor']
  writeFileSync(
    join(folder, route.replaceAll('/', '_') + '.json'),
    JSON.stringify(
      {
        route,
        viewport: size,
        violationCount: result.violations.length,
        blockingCount: blocking.length,
        counts: Object.fromEntries(
          impacts.map((impact) => [
            impact,
            result.violations.filter((violation) => violation.impact === impact).length,
          ]),
        ),
        violations: result.violations.map((v) => ({
          rule: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
            contrast: n.any.find((check) => check.id === 'color-contrast')?.data ?? null,
          })),
        })),
      },
      null,
      2,
    ),
  )
  expect
    .soft(
      blocking.map(
        (issue) =>
          `${issue.id} (${issue.nodes.length} targets): ${issue.nodes.map((node) => node.target.join(' ')).join(', ')}`,
      ),
      `${size} ${route} axe serious/critical; evidence at ${OUTPUT}/axe/${size}`,
    )
    .toEqual([])
  if (result.violations.length) {
    test.info().annotations.push({
      type: 'a11y',
      description: `${route}: ${result.violations.map((v) => v.id + '=' + v.impact + '/' + v.nodes.length).join(' ')}`,
    })
  }
}

async function noViewportOverflow(page, size, route) {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect
    .soft(
      dimensions.scroll,
      `${size} ${route} document overflow: ${JSON.stringify(dimensions)}`,
    )
    .toBeLessThanOrEqual(dimensions.width + 1)
  expect
    .soft(dimensions.body, `${size} ${route} body overflow: ${JSON.stringify(dimensions)}`)
    .toBeLessThanOrEqual(dimensions.width + 1)
}

async function openRealVault(page, folder) {
  const input = page.getByLabel('Ruta de la carpeta')
  const toggle = page.getByRole('button', { name: 'Escribir la ruta a mano' })
  await input.or(toggle).first().waitFor({ state: 'visible' })
  if (!(await input.isVisible())) await toggle.click()
  await input.fill(folder)
  await page.getByRole('button', { name: 'Abrir', exact: true }).click()
  await page.waitForURL(/\/(onboarding|today)(?:[/?]|$)/, { timeout: 25_000 })
}

async function onboardThroughRealCatalog(page) {
  await expect(page.getByRole('heading', { name: /Organicemos tu recorrido/ })).toBeVisible()
  const preferred = {
    Universidad: /Universidad Tecnológica Nacional/i,
    'Facultad o regional': /Facultad Regional Rosario/i,
    Carrera: /Ingeniería en Sistemas/i,
    'Plan de estudios': /Plan 2023/i,
  }
  for (const legend of ['Universidad', 'Facultad o regional', 'Carrera', 'Plan de estudios']) {
    const options = page.getByRole('group', { name: legend, exact: true }).getByRole('radio')
    await expect(
      options.first(),
      `A real catalog must provide at least one ${legend} option`,
    ).toBeVisible()
    const first = page
      .getByRole('group', { name: legend, exact: true })
      .getByRole('radio', { name: preferred[legend] })
    // Selecting a radio immediately advances/unmounts the current fieldset.
    // locator.check() waits to re-read checked after click and times out on
    // that intentional unmount; click is the correct user interaction here.
    await first.click()
  }
  await page.getByRole('button', { name: /Guardar y continuar/ }).click()
  await expect(page.getByRole('heading', { name: /Tu plan ya está en Campus/ })).toBeVisible()
  await page.getByRole('button', { name: /Marcar estado de materias/ }).click()
  await page.waitForURL(/\/plan\/progress/)
}

/** No interception of the app or network: this is a real localhost Vault and browser. */
for (const size of VIEWPORTS) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } })
    test(`Local startup + real academic setup + navigation + QA ${size.name}`, async ({
      page,
    }) => {
      const vault = join(ROOT, 'Vault-' + size.name)
      mkdirSync(vault, { recursive: true })
      const consoleErrors = []
      const pageErrors = []
      const failedResponses = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })
      page.on('pageerror', (err) => pageErrors.push(err.message))
      page.on('response', (response) => {
        if (
          response.status() >= 400 &&
          new URL(response.url()).hostname === '127.0.0.1' &&
          new URL(response.url()).port === new URL(process.env.CAMPUS_BLUE_BASE_URL).port
        ) {
          failedResponses.push(`${response.status()} ${new URL(response.url()).pathname}`)
        }
      })

      await page.goto('/')
      await expect(
        page.getByRole('heading', { name: /Elegí cómo querés usar Campus/ }),
      ).toBeVisible()
      await snapshot(page, size.name, '00-startup')
      const startupSurface = await page.evaluate(() => {
        const main = document.querySelector('main.blue-startup')
        const rect = main?.getBoundingClientRect()
        return {
          left: rect?.left,
          right: rect?.right,
          width: document.documentElement.getBoundingClientRect().width,
          bodyBackground: getComputedStyle(document.body).backgroundColor,
        }
      })
      expect(startupSurface.left).toBe(0)
      expect(startupSurface.right).toBeGreaterThanOrEqual(startupSurface.width - 1)
      expect(startupSurface.bodyBackground).toBe('rgb(248, 251, 255)')
      await noViewportOverflow(page, size.name, 'startup')
      await accessible(page, 'startup', size.name)

      // A real keyboard-only entry point, without any UI mocks.
      await page.keyboard.press('Tab')
      const focusTag = await page.evaluate(() => document.activeElement?.tagName)
      expect(['A', 'BUTTON', 'INPUT']).toContain(focusTag)

      await openRealVault(page, vault)
      await snapshot(page, size.name, '01-onboarding')
      await noViewportOverflow(page, size.name, 'onboarding')
      await accessible(page, 'onboarding', size.name)
      await onboardThroughRealCatalog(page)

      // Persist a real subject status through the existing Vault backend,
      // including a reload, then restore the test fixture to its initial state.
      const progressYear = page.locator('details.blue-year-group').first()
      await progressYear.locator('summary').click()
      const firstStateGroup = progressYear
        .locator('[role="group"][aria-label^="Estado de "]')
        .first()
      // The Guardado status is a sibling of the labeled group, in the same
      // status-control wrapper, so wait on that wrapper before reloading.
      const firstState = firstStateGroup.locator('xpath=..')
      const subjectName = (await firstStateGroup.getAttribute('aria-label'))?.replace(
        /^Estado de /,
        '',
      )
      expect(subjectName).toBeTruthy()
      await firstStateGroup.getByRole('button').click()
      await page
        .getByRole('group', { name: `Elegir estado de ${subjectName}` })
        .getByRole('button', { name: 'Cursando' })
        .click()
      await expect(
        page.getByRole('button', {
          name: `Estado de ${subjectName}: Cursando. Cambiar estado`,
        }),
      ).toBeVisible()
      await expect(firstState.getByText('Guardado', { exact: true })).toBeVisible()
      await page.reload()
      await expect(progressYear).toHaveAttribute('open')
      const savedState = page.getByRole('button', {
        name: `Estado de ${subjectName}: Cursando. Cambiar estado`,
      })
      await expect(savedState).toBeVisible()
      await savedState.click()
      await page
        .getByRole('group', { name: `Elegir estado de ${subjectName}` })
        .getByRole('button', { name: 'Sin marcar' })
        .click()
      await expect(firstState.getByText('Guardado', { exact: true })).toBeVisible()
      await page.reload()
      await expect(progressYear).not.toHaveAttribute('open')

      for (const route of ROUTES) {
        await test.step(`real route ${route.path}`, async () => {
          await page.goto(route.path, { waitUntil: 'domcontentloaded' })
          await expect(page, route.path).toHaveURL(
            new RegExp(route.path.replaceAll('/', '\\/') + '(?:\\?.*)?$'),
          )
          if (route.heading) {
            await expect
              .soft(
                page.getByRole('heading', { name: route.heading, exact: false }).first(),
                route.path,
              )
              .toBeVisible()
          } else if (route.landmark) {
            await expect
              .soft(
                page
                  .getByRole('region', { name: route.landmark })
                  .or(page.getByRole('complementary', { name: route.landmark }))
                  .first(),
                route.path,
              )
              .toBeVisible()
          }
          await expect
            .soft(page.locator('main').first(), `${route.path} content landmark`)
            .toBeVisible()
          await page.waitForLoadState('networkidle').catch(() => {})
          await noViewportOverflow(page, size.name, route.path)
          await snapshot(page, size.name, route.label)
          await accessible(page, route.path, size.name)
        })
      }

      // Proposal 2 design contract: local Prompt, one light theme, dynamic
      // time-based backdrop, and keyboard-operable academic year disclosure.
      await page.goto('/plan')
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      await expect(page.locator('html')).toHaveAttribute(
        'data-campus-period',
        /^(morning|afternoon|evening|night)$/,
      )
      const years = page.locator('details.blue-year-group')
      await expect(years.first()).toBeVisible()
      const presentation = await page.evaluate(async () => {
        await document.fonts.load('400 16px Prompt')
        return {
          promptLoaded: document.fonts.check('400 16px Prompt'),
          fontFamily: getComputedStyle(document.body).fontFamily,
          period: document.documentElement.dataset.campusPeriod,
        }
      })
      expect(presentation.promptLoaded).toBe(true)
      expect(presentation.fontFamily).toMatch(/Prompt/)
      expect(['morning', 'afternoon', 'evening', 'night']).toContain(presentation.period)

      expect(await years.count()).toBeGreaterThanOrEqual(1)
      const firstYear = years.first()
      // No in-progress subjects in this isolated Vault: initially closed.
      await expect(firstYear).not.toHaveAttribute('open')
      await firstYear.locator('summary').focus()
      await page.keyboard.press('Enter')
      await expect(firstYear).toHaveAttribute('open')
      await page.keyboard.press('Enter')
      await expect(firstYear).not.toHaveAttribute('open')

      // A real local resource mutation, not a synthetic fixture or hidden app API.
      await page.goto('/library')
      await page.getByRole('button', { name: 'Agregar material' }).first().click()
      await page.getByLabel('Tipo', { exact: true }).selectOption('note')
      await page.getByRole('textbox', { name: /Título/ }).fill('Nota QA reproducible')
      await page.getByRole('textbox', { name: /Nota/ }).fill('Fixture sin datos personales.')
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await expect(page.getByText('Nota QA reproducible')).toBeVisible()
      await snapshot(page, size.name, 'material-real-resource')
      await page.getByRole('button', { name: 'Borrar Nota QA reproducible' }).click()
      await expect(page.getByText('Nota QA reproducible')).toHaveCount(0)

      await page.goto('/today')
      await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible()
      await page.keyboard.press('Control+k')
      await expect(page.getByRole('dialog', { name: 'Buscar en Campus' })).toBeVisible()
      await expect(page.getByRole('combobox')).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog', { name: 'Buscar en Campus' })).toHaveCount(0)

      // No blanket dismissal of console/network failures (e.g. missing images).
      expect.soft(pageErrors, `${size.name} uncaught browser exceptions`).toEqual([])
      expect.soft(failedResponses, `${size.name} local HTTP response failures`).toEqual([])
      expect.soft(consoleErrors, `${size.name} console.error messages`).toEqual([])
    })
  })
}
