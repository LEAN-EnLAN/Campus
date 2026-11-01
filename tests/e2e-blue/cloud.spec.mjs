import { test, expect } from '@playwright/test'
const email = process.env.CAMPUS_BLUE_CLOUD_EMAIL
const oldPass = process.env.CAMPUS_BLUE_CLOUD_PASSWORD
const newPass = process.env.CAMPUS_BLUE_CLOUD_NEXT_PASSWORD
const mailpit = process.env.CAMPUS_BLUE_CLOUD_MAILPIT
const base = process.env.CAMPUS_BLUE_BASE_URL

async function mailLink(kind) {
  const until = Date.now() + 25000
  while (Date.now() < until) {
    const res = await fetch(mailpit + '/api/v1/messages')
    const messages = (await res.json()).messages ?? []
    const match = messages.find((m) =>
      (m.To ?? []).some((t) => t.Address?.toLowerCase() === email.toLowerCase()),
    )
    if (match) {
      const message = await (await fetch(mailpit + '/api/v1/message/' + match.ID)).json()
      const body = message.HTML ?? message.Text ?? ''
      const links = [...body.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) =>
        m[0].replaceAll('&amp;', '&'),
      )
      const link = links.find(
        (l) =>
          l.includes('/auth/v1/verify') &&
          (kind === 'recovery' ? l.includes('recovery') : true),
      )
      if (link) return link
    }
    await new Promise((done) => setTimeout(done, 500))
  }
  return null
}

test('Cloud signup, signin, recovery, password change and failures (real local Supabase)', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Entrar o crear cuenta/ }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.getByRole('textbox', { name: /Email/ }).fill(email)
  await page.getByLabel('Contraseña', { exact: false }).fill(oldPass)
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).last().click()
  await expect(page).toHaveURL(/\/(onboarding|today)/, { timeout: 20000 })
  // Registration confirmation is disabled in the local supabase/config.toml.
  await page.goto('/settings')
  await page.getByRole('button', { name: /Cerrar sesión/ }).click()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.getByRole('textbox', { name: /Email/ }).fill(email)
  await page.getByLabel('Contraseña', { exact: false }).fill('WrongQaPassword!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/incorrectos|operación|intentos/i)
  await page.getByLabel('Contraseña', { exact: false }).fill(oldPass)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/(onboarding|today)/, { timeout: 20000 })
  await page.goto('/settings')
  await page.getByRole('button', { name: /Cerrar sesión/ }).click()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.getByRole('button', { name: 'Recuperar contraseña' }).click()
  await page.getByRole('textbox', { name: /Email/ }).fill(email)
  await page
    .getByRole('button', { name: /Enviar enlace|Recuperar|Restablecer/i })
    .last()
    .click()
  await expect(page.getByRole('status')).toContainText(/enlace|correo|email/i)
  const link = await mailLink('recovery')
  expect(link, 'No recovery email in local Mailpit').toBeTruthy()
  // The real GoTrue verification link is followed; the email redirect is limited
  // to configured site_url (3000), so change only the final app-origin navigation.
  const response = await page.request.get(link, { maxRedirects: 0 })
  const location = response.headers()['location']
  expect(location, 'GoTrue verification must return Location').toBeTruthy()
  const redirected = new URL(location)
  const target = new URL(base)
  redirected.host = target.host
  redirected.protocol = target.protocol
  await page.goto(redirected.toString())
  await expect(page.getByRole('heading', { name: /contraseña nueva/i })).toBeVisible()
  await page.getByLabel('Contraseña', { exact: false }).fill(newPass)
  await page
    .getByRole('button', { name: /Guardar|Actualizar|Cambiar/i })
    .last()
    .click()
  await expect(page).toHaveURL(/\/(today|onboarding)/)
  await page.goto('/settings')
  await page.getByRole('button', { name: /Cerrar sesión/ }).click()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.getByRole('textbox', { name: /Email/ }).fill(email)
  await page.getByLabel('Contraseña', { exact: false }).fill(newPass)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/(onboarding|today)/)
})
