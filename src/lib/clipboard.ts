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
