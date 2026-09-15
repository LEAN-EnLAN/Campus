import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'

import { clampToHarmony, harmonic, toCss } from '@/lib/design/palette'

import {
  ACCENT_STORAGE_KEY,
  readAccentHue,
  readThemePreference,
  resolveTheme,
  SYSTEM_DARK_QUERY,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemePreference,
} from './theme'

interface ThemeValue {
  /** What the student chose, including "follow the system". */
  preference: ThemePreference
  /** What that resolves to right now. */
  theme: Theme
  setPreference: (preference: ThemePreference) => void
  /** The chosen accent hue, or null while the palette's own teal is in use. */
  accentHue: number | null
  /** Pass null to go back to Tropical Teal. */
  setAccentHue: (hue: number | null) => void
}

/**
 * Repaint the accent from one hue.
 *
 * The accent is four tokens, not one — the fill, its soft surface, the ink on
 * that surface, and the ink that goes ON the fill. Deriving all four from the
 * hue through `harmonic` is what makes a chosen colour a member of the palette
 * rather than a stain on it: the lightness and chroma come from the envelope,
 * and only the hue comes from the student.
 */
function applyAccent(hue: number | null, theme: Theme) {
  const root = document.documentElement
  const vars = ['--color-accent', '--color-accent-soft', '--color-accent-ink']

  if (hue === null) {
    // Remove rather than write the default back: the stylesheet already holds
    // it, and two sources for one value is how they drift.
    for (const name of vars) root.style.removeProperty(name)
    return
  }

  const safe = clampToHarmony({ l: 0, c: 0, h: hue }).h
  root.style.setProperty('--color-accent', toCss(harmonic(safe, 'subject', theme)))
  root.style.setProperty('--color-accent-soft', toCss(harmonic(safe, 'soft', theme)))
  root.style.setProperty('--color-accent-ink', toCss(harmonic(safe, 'ink', theme)))
}

const ThemeContext = createContext<ThemeValue | null>(null)

/**
 * Owns the one attribute that switches the palette.
 *
 * The preference is DEVICE-scoped, like the recent-vault list: which machine
 * you are on is not something to carry into a synced folder, and a phone in a
 * dark room and a desktop under a window are allowed to disagree.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readThemePreference(
      typeof localStorage === 'undefined' ? null : localStorage.getItem(THEME_STORAGE_KEY),
    ),
  )
  const [accentHue, setAccentHueState] = useState<number | null>(() =>
    readAccentHue(
      typeof localStorage === 'undefined' ? null : localStorage.getItem(ACCENT_STORAGE_KEY),
    ),
  )
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(SYSTEM_DARK_QUERY).matches,
  )

  // Subscribed, not sampled: someone on `system` who flips their OS at sunset
  // should see Campus follow without a reload.
  useEffect(() => {
    const query = window.matchMedia(SYSTEM_DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    setSystemDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const theme = resolveTheme(preference, systemDark)

  useEffect(() => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme)
  }, [theme])

  // Re-derived on every theme change too: the same hue needs a different
  // lightness to read on Linen and on Shadow Grey.
  useEffect(() => {
    applyAccent(accentHue, theme)
  }, [accentHue, theme])

  const setAccentHue = useCallback((hue: number | null) => {
    setAccentHueState(hue)
    try {
      if (hue === null) localStorage.removeItem(ACCENT_STORAGE_KEY)
      else localStorage.setItem(ACCENT_STORAGE_KEY, String(hue))
    } catch {
      // Same as the theme: applying it is what matters, remembering it is a
      // nicety that must not break a render.
    }
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Private mode, a full quota, a locked-down browser. The theme still
      // applies for this session; only remembering it fails, and that is not
      // worth breaking a render over.
    }
  }, [])

  return (
    <ThemeContext value={{ preference, theme, setPreference, accentHue, setAccentHue }}>
      {children}
    </ThemeContext>
  )
}

export function useTheme(): ThemeValue {
  const value = use(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
