import { test, expect } from '@playwright/test'

/**
 * WP1: copy a date's link as A → open it as B (another plan) → log in →
 * the capture form is prefilled, with no subject and its name in the title →
 * save → it is on B's Hoy.
 *
 * Needs the LOCAL Supabase seeded with the tester scenarios (`pnpm tester`):
 * A = UTN (utn-activo), B = UNR (unr), so A's subject id is not in B's plan.
 */
const PASSWORD = process.env.CAMPUS_SHARE_PASSWORD ?? 'campus-tester'
const A = process.env.CAMPUS_SHARE_A_EMAIL ?? 'tester-utn-activo@tester.campus.local'
const B = process.env.CAMPUS_SHARE_B_EMAIL ?? 'tester-unr@tester.campus.local'
const base = process.env.CAMPUS_BLUE_BASE_URL

async function logIn(page, email) {
  await expect(page).toHaveURL(/\/login/)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.getByRole('textbox', { name: /Email/ }).fill(email)
  await page.getByLabel('Contraseña', { exact: false }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

async function logOut(page) {
  await page.goto('/settings')
  await page.getByRole('button', { name: /Cerrar sesión/ }).click()
  await expect(page).toHaveURL(/\/login|\/$/)
}

test('a shared date opens prefilled for another student and lands on their Hoy', async ({
  page,
}) => {
  const title = `Parcial compartido ${Date.now()}`

  // A: create a dated item on one of their subjects.
  await page.goto('/login')
  await logIn(page, A)
  await expect(page).toHaveURL(/\/today/, { timeout: 20000 })
  await page.getByRole('button', { name: 'Agregar entrega' }).click()
  const capture = page.getByRole('dialog')
  await capture.getByRole('textbox', { name: '¿Qué es?' }).fill(title)
  await capture.getByLabel('Tipo').selectOption('midterm')
  const subject = capture.getByLabel('Materia')
  await subject.selectOption({ index: 1 })
  const subjectName = (await subject.locator('option:checked').textContent())?.trim()
  expect(subjectName).toBeTruthy()
  const due = new Date(Date.now() + 3 * 86400000)
  const dd = String(due.getDate()).padStart(2, '0')
  const mm = String(due.getMonth() + 1).padStart(2, '0')
  await capture.getByLabel('Fecha').fill(`${dd}/${mm}/${due.getFullYear()}`)
  await capture.getByLabel('Hora').fill('18:30')
  await capture.getByRole('button', { name: 'Guardar' }).click()
  await expect(capture).toBeHidden()

  // A: copy it for WhatsApp.
  await page.getByRole('button', { name: `Copiar ${title} para WhatsApp` }).click()
  await expect(page.getByRole('status')).toContainText('Copiado')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  const [line, link] = copied.split('\n')
  expect(line).toBe(`Parcial · ${subjectName} · ${line.split(' · ')[2]}`)
  expect(line).toMatch(new RegExp(`${dd}/${mm} 18:30$`))
  const shared = new URL(link)
  expect(shared.pathname).toBe('/add')
  expect([...shared.searchParams.keys()].sort()).toEqual(
    ['due', 'kind', 'ref', 'subject', 'subjectName', 'title'].sort(),
  )

  // B, logged out, opens the link.
  await logOut(page)
  const target = new URL(base)
  shared.protocol = target.protocol
  shared.host = target.host
  await page.goto(shared.toString())
  await logIn(page, B)
  await expect(page).toHaveURL(/\/today/, { timeout: 20000 })

  const prefilled = page.getByRole('dialog', { name: 'Agregar parcial' })
  await expect(prefilled).toBeVisible()
  await expect(prefilled.getByRole('textbox', { name: '¿Qué es?' })).toHaveValue(
    `${title} (${subjectName})`,
  )
  await expect(prefilled.getByLabel('Materia')).toHaveValue('')
  await expect(prefilled.getByLabel('Hora')).toHaveValue('18:30')
  await prefilled.getByRole('button', { name: 'Guardar' }).click()
  await expect(prefilled).toBeHidden()

  await expect(page.getByText(`${title} (${subjectName})`).first()).toBeVisible()

  // Leave both accounts as they were.
  await page.getByRole('button', { name: `Eliminar ${title} (${subjectName})` }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click()
  await logOut(page)
  await page.goto('/login')
  await logIn(page, A)
  await expect(page).toHaveURL(/\/today/, { timeout: 20000 })
  await page.getByRole('button', { name: `Eliminar ${title}` }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click()
})
