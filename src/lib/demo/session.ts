/**
 * Is this tab in the demo?
 *
 * `/demo` asks for it; a flag in sessionStorage keeps a reload inside the demo
 * (on `/today`, say) from dropping the visitor on the picker. Session-scoped on
 * purpose: closing the tab ends the demo, which is what "nada se guarda" says.
 */

const KEY = 'campus.demo.v1'

export function isDemoPath(pathname: string): boolean {
  return pathname === '/demo' || pathname.startsWith('/demo/')
}

export function demoRequested(pathname: string = window.location.pathname): boolean {
  if (isDemoPath(pathname)) return true
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function markDemoSession(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // Without storage a reload leaves the demo. Acceptable: nothing is lost.
  }
}

export function clearDemoSession(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
