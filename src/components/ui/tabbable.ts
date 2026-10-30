const CANDIDATES =
  'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"]'

function isRendered(el: HTMLElement, root: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (node.hidden || node.hasAttribute('inert')) return false
    const style = getComputedStyle(node)
    if (style.display === 'none' || (node === el && style.visibility === 'hidden')) return false
    if (node === root) break
  }
  return true
}

/**
 * The controls Tab can actually land on, in DOM order.
 *
 * A bare `input` selector over-counts: a radio group is ONE tab stop (the
 * checked radio, or the first when none is checked), so the visually hidden
 * siblings must not be treated as the "last" control or the trap never wraps.
 */
export function tabbables(root: HTMLElement): HTMLElement[] {
  const candidates = [...root.querySelectorAll<HTMLElement>(CANDIDATES)].filter(
    (el) =>
      el.tabIndex >= 0 &&
      !(el as HTMLButtonElement).disabled &&
      !el.closest('fieldset:disabled') &&
      isRendered(el, root),
  )

  const groupStop = new Map<string, HTMLInputElement>()
  const radioKey = (el: HTMLInputElement) => `${el.form?.id ?? ''}\u0000${el.name}`
  for (const el of candidates) {
    if (!(el instanceof HTMLInputElement) || el.type !== 'radio' || !el.name) continue
    const key = radioKey(el)
    const current = groupStop.get(key)
    if (!current || (el.checked && !current.checked)) groupStop.set(key, el)
  }

  return candidates.filter(
    (el) =>
      !(el instanceof HTMLInputElement) ||
      el.type !== 'radio' ||
      !el.name ||
      groupStop.get(radioKey(el)) === el,
  )
}
