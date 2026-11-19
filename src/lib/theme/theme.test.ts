import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  ACCENT_STORAGE_KEY,
  ACCENTS,
  accentIdForHue,
  readAccentHue,
  readThemePreference,
  resolveTheme,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from './theme'

describe('resolveTheme', () => {
  it('honours an explicit choice over the system', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the system when the choice is to follow it', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('readThemePreference', () => {
  it('reads the three real values', () => {
    expect(readThemePreference('light')).toBe('light')
    expect(readThemePreference('dark')).toBe('dark')
    expect(readThemePreference('system')).toBe('system')
  })

  it('falls back to following the system rather than guessing', () => {
    // Device preferences are edited by hand, survive across versions and can be
    // whatever a previous build wrote. "Follow the system" is the only default
    // that is never wrong for someone — picking light would flash a white app
    // at a person whose machine is dark.
    expect(readThemePreference(null)).toBe('system')
    expect(readThemePreference('')).toBe('system')
    expect(readThemePreference('Dark')).toBe('system')
    expect(readThemePreference('{"mode":"dark"}')).toBe('system')
  })
})

describe('the contract the boot script depends on', () => {
  it('pins the storage key and attribute, because index.html repeats them', () => {
    // The inline script in index.html cannot import this module — it runs
    // before any bundle — so it hardcodes both strings. If either changes here
    // without changing there, the app renders light for a frame and then
    // repaints dark. This test is the thing that notices.
    expect(THEME_STORAGE_KEY).toBe('campus.theme')
    expect(THEME_ATTRIBUTE).toBe('data-theme')
  })
})

describe('readAccentHue', () => {
  it('accepts a hue anywhere on the wheel', () => {
    expect(readAccentHue('0')).toBe(0)
    expect(readAccentHue('202')).toBe(202)
    expect(readAccentHue('360')).toBe(360)
  })

  it('treats anything that is not a usable hue as absent', () => {
    // This matters more than it looks. A NaN reaching `oklch()` makes the
    // custom property invalid, every element painted with it falls back to
    // unstyled, and the app loses its accent entirely — because one
    // hand-editable localStorage key held junk.
    for (const junk of [null, '', '   ', 'teal', 'NaN', '-1', '361', '1e999']) {
      expect(readAccentHue(junk)).toBeNull()
    }
  })
})

describe('accents', () => {
  it('maps every offered hue to its id and anything else to Azul Campus', () => {
    for (const accent of ACCENTS) expect(accentIdForHue(accent.hue)).toBe(accent.id)
    expect(accentIdForHue(null)).toBe('azul')
    expect(accentIdForHue(202)).toBe('azul')
  })

  it('keeps the boot script in index.html in step with ACCENTS', () => {
    // The boot script cannot import theme.ts, so it repeats the hue -> id
    // table. If the two drift, a reload paints a different accent for a frame.
    const html = readFileSync('index.html', 'utf8')
    for (const accent of ACCENTS) expect(html).toContain(`${accent.hue}: '${accent.id}'`)
    expect(html).toContain(`'${THEME_STORAGE_KEY}'`)
    expect(html).toContain(`'${ACCENT_STORAGE_KEY}'`)
  })

  it('has a token block for every accent in both themes', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8')
    for (const accent of ACCENTS) {
      expect(css).toContain(`:root[data-accent='${accent.id}'] :is(.campus-blue`)
      expect(css).toContain(`:root[data-theme='dark'][data-accent='${accent.id}']`)
    }
  })
})
