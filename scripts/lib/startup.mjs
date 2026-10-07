/**
 * The first screen, as the journey scripts drive it.
 *
 * Typing a folder path is the shortcut on that screen: it sits behind "Escribir la
 * ruta a mano" while the folder picker is offered, and is open from the start
 * where it is not. Scripts that open a folder by path go through here so they do
 * not each learn that.
 */

/** Make the typed-path field visible and return its locator. */
export async function revealPathField(page) {
  const field = page.getByLabel('Ruta de la carpeta')
  const toggle = page.getByRole('button', { name: 'Escribir la ruta a mano' })
  await field.or(toggle).first().waitFor({ state: 'visible', timeout: 20_000 })
  if (!(await field.isVisible())) await toggle.click()
  await field.waitFor({ state: 'visible', timeout: 5_000 })
  return field
}

/** Open a folder by typing its path on the first screen. */
export async function openFolderByPath(page, path) {
  const field = await revealPathField(page)
  await field.fill(path)
  await page.getByRole('button', { name: 'Abrir', exact: true }).click()
}
