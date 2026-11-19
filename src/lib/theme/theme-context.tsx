import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'

import {
  ACCENT_ATTRIBUTE,
  ACCENT_STORAGE_KEY,
  accentIdForHue,
  DEFAULT_ACCENT_HUE,
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
  /** The chosen accent hue (an id into ACCENTS); null means Azul Campus. */
  accentHue: number | null
  /** Pass null to go back to Azul Campus. */
  setAccentHue: (hue: number | null) => void
}

/**
 * Paint the accent: one attribute on <html>. The colours themselves live in
 * tokens.css, per accent AND per theme, for the root and every blue scope —
 * an inline custom property on <html> would be overridden by `.campus-blue`,
 * which is exactly why the old picker did nothing.
 */
function applyAccent(hue: number | null) {
  document.documentElement.setAttribute(ACCENT_ATTRIBUTE, accentIdForHue(hue))
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
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
  // Read once from the device. The boot script in index.html has already put
  // the same answer on <html>, so the first paint and this state agree.
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readThemePreference(readStored(THEME_STORAGE_KEY)),
  )
  const [accentHue, setAccentHueState] = useState<number | null>(
    () => readAccentHue(readStored(ACCENT_STORAGE_KEY)) ?? DEFAULT_ACCENT_HUE,
  )
  useEffect(() => {
    const refresh = () => {
      const hour = new Date().getHours()
      document.documentElement.dataset.campusPeriod =
        hour < 6 || hour >= 22
          ? 'night'
          : hour < 12
            ? 'morning'
            : hour < 18
              ? 'afternoon'
              : 'evening'
    }
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      window.clearInterval(timer)
      delete document.documentElement.dataset.campusPeriod
    }
  }, [])
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

  useEffect(() => {
    applyAccent(accentHue)
  }, [accentHue])

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
