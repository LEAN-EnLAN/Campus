/**
 * Screenshot-only walkthrough used to prove a design-system change is visually
 * neutral (before/after diff) or to document new imagery.
 * Run: node scripts/design-shots.mjs   (DESIGN_SHOTS_OUT=<dir> to choose where)
 * Compare: node scripts/design-diff.mjs <before-dir> <after-dir>
 */
import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.env.CAMPUS_BLUE_VAULT_ROOT
const OUTPUT = process.env.DESIGN_SHOTS_OUT
if (!ROOT || !OUTPUT || !process.env.CAMPUS_BLUE_BASE_URL) {
  throw new Error('Run with node scripts/design-shots.mjs; it isolates the Vault and output.')
}

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
]
const ROUTES = [
  ['/today', 'today'],
  ['/plan', 'plan'],
  ['/courses', 'courses'],
  ['/calendar', 'calendar'],
  ['/library', 'library'],
  ['/settings', 'settings'],
  ['/vault', 'vault'],
  ['/plan/progress', 'progress'],
  ['/__no-such-route', 'not-found'],
]

async function shot(page, size, name) {
  const folder = join(OUTPUT, size)
  mkdirSync(folder, { recursive: true })
  await page.addStyleTag({
    content: '*{caret-color:transparent!important} [data-campus-period]{--x:0}',
  })
  await page.screenshot({ path: join(folder, name + '.png'), animations: 'disabled' })
}

for (const size of VIEWPORTS) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce' })
    test(`walkthrough ${size.name}`, async ({ page }) => {
      const vault = join(ROOT, 'Vault-' + size.name)
      mkdirSync(vault, { recursive: true })

      await page.goto('/')
      await expect(
        page.getByRole('heading', { name: /Elegí cómo querés usar Campus/ }),
      ).toBeVisible()
      await page.waitForLoadState('networkidle').catch(() => {})
      await shot(page, size.name, '00-startup')

      // Folder picker (Local).
      const input = page.getByLabel('Ruta de la carpeta')
      const toggle = page.getByRole('button', { name: 'Escribir la ruta a mano' })
      await input.or(toggle).first().waitFor({ state: 'visible' })
      await shot(page, size.name, '01-folder-picker')
      if (!(await input.isVisible())) await toggle.click()
      await input.fill(vault)
      await page.getByRole('button', { name: 'Abrir', exact: true }).click()
      await page.waitForURL(/\/(onboarding|today)(?:[/?]|$)/, { timeout: 25_000 })
      await expect(
        page.getByRole('heading', { name: /Organicemos tu recorrido/ }),
      ).toBeVisible()
      await page.waitForLoadState('networkidle').catch(() => {})
      await shot(page, size.name, '02-onboarding-university')

      const preferred = {
        Universidad: /Universidad Tecnológica Nacional/i,
        'Facultad o regional': /Facultad Regional Rosario/i,
        Carrera: /Ingeniería en Sistemas/i,
        'Plan de estudios': /Plan 2023/i,
      }
      let step = 3
      for (const legend of Object.keys(preferred)) {
        await page
          .getByRole('group', { name: legend, exact: true })
          .getByRole('radio', { name: preferred[legend] })
          .click()
        if (legend !== 'Plan de estudios') {
          await page.waitForTimeout(250)
          await shot(
            page,
            size.name,
            `0${step++}-onboarding-after-${legend.split(' ')[0].toLowerCase()}`,
          )
        }
      }
      await shot(page, size.name, '07-onboarding-confirm')
      await page.getByRole('button', { name: /Guardar y continuar/ }).click()
      await expect(
        page.getByRole('heading', { name: /Tu plan ya está en Campus/ }),
      ).toBeVisible()
      await shot(page, size.name, '08-onboarding-ready')
      await page.getByRole('button', { name: /Marcar estado de materias/ }).click()
      await page.waitForURL(/\/plan\/progress/)

      for (const [path, label] of ROUTES) {
        await page.goto(path, { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle').catch(() => {})
        await page.waitForTimeout(300)
        await shot(page, size.name, `10-${label}`)
      }

      // The shared modal.
      await page.goto('/today', { waitUntil: 'domcontentloaded' })
      const add = page.getByRole('button', { name: /Agregar tarea|Agregar entrega/ }).first()
      if (await add.isVisible().catch(() => false)) {
        await add.click()
        await page.getByRole('dialog').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
        await shot(page, size.name, '20-modal-quick-capture')
      }
    })
  })
}
