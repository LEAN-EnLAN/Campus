/**
 * Which palette the app is wearing.
 *
 * There is no `dark:` variant anywhere in Campus. Both themes are the same
 * eighteen tokens with different values, and the only thing that switches is
 * one attribute on `<html>` — which is why a screen, the CodeMirror theme and
 * the vendored calendar all follow without any of them knowing a theme exists.
 */

export type Theme = 'light' | 'dark'
/** `system` is a real choice, not the absence of one. */
export type ThemePreference = Theme | 'system'

/**
 * Both of these are REPEATED in `index.html`.
 *
 * The boot script there runs before any bundle, so it cannot import them, and
 * it has to exist: without it the first paint uses the light palette and then
 * repaints dark, which is the flash every dark mode is judged by. `theme.test.ts`
 * pins both strings so the duplication cannot drift silently.
 */
export const THEME_STORAGE_KEY = 'campus.theme'
export const THEME_ATTRIBUTE = 'data-theme'

export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

/** The palette a preference resolves to right now. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

/**
 * A stored preference, or `system` when there is nothing usable.
 *
 * Deliberately strict about what it accepts: device preferences outlive the
 * code that wrote them, and the fallback has to be the one answer that is never
 * wrong for anyone. Defaulting to light would greet someone whose machine is
 * dark with a white screen.
 */
export function readThemePreference(raw: string | null): ThemePreference {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system'
}

/** Where the chosen accent hue is remembered. Device-scoped, like the theme. */
export const ACCENT_STORAGE_KEY = 'campus.accent-hue'

/**
 * A stored accent hue, or null to keep the palette's own.
 *
 * Anything that is not a finite number in 0–360 is treated as absent rather
 * than coerced: a `NaN` reaching `oklch()` produces an invalid colour, and an
 * invalid colour in a custom property makes every element painted with it fall
 * back to unstyled — the whole app loses its accent because one localStorage
 * key was edited by hand.
 */
export function readAccentHue(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null
  const hue = Number(raw)
  return Number.isFinite(hue) && hue >= 0 && hue <= 360 ? hue : null
}
