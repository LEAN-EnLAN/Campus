/**
 * Read the clipboard only when the student already allowed it.
 *
 * Opening a dialog must never pop a permission prompt, so this returns null
 * unless `clipboard-read` is already `granted` (Chromium). Browsers that cannot
 * report the permission (Firefox, Safari) also get null; the student still has
 * Ctrl+V and the explicit paste button.
 */
export async function readClipboardTextIfGranted(): Promise<string | null> {
  try {
    if (typeof navigator === 'undefined') return null
    const { permissions } = navigator
    if (typeof permissions?.query !== 'function') return null
    // `clipboard-read` is Chromium-only and missing from lib.dom's PermissionName.
    const descriptor = { name: 'clipboard-read' } as unknown as PermissionDescriptor
    const status = await permissions.query(descriptor)
    if (status.state !== 'granted') return null
    return await readClipboardText()
  } catch {
    return null
  }
}

/**
 * Read the clipboard because the student asked to (a click). The browser may
 * ask for permission here, which is fine: it follows the student's own action.
 * Any failure is null.
 */
export async function readClipboardText(): Promise<string | null> {
  try {
    if (typeof navigator === 'undefined') return null
    if (typeof navigator.clipboard?.readText !== 'function') return null
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}

/**
 * Write text because the student asked to (a click). The async Clipboard API
 * needs a secure context and focus — the web app on https and the desktop
 * shell on `http://campus.localhost` both qualify. Where it is missing or
 * refuses, a hidden textarea and `execCommand('copy')`, still inside the
 * same click. False when neither worked; nothing throws.
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.clipboard?.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  return copyWithTextarea(text)
}

function copyWithTextarea(text: string): boolean {
  if (typeof document === 'undefined') return false
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
  try {
    area.select()
    // Deprecated, and still the only fallback some webviews honour.
    return typeof document.execCommand === 'function' && document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
    previous?.focus()
  }
}
