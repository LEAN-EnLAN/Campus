import { readdirSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { contrastRatio, parseOklch } from './contrast'
import type { Oklch } from './palette'
import { eventPaint } from '@/features/calendar/event-paint'

/**
 * Contrast, measured from the tokens the stylesheet actually ships.
 *
 * The thresholds are WCAG 2.2: 4.5:1 for text (1.4.3), 3:1 for the visual
 * information a control needs to be found and operated (1.4.11 — focus ring,
 * input borders). Both themes, because dark is the same tokens with night
 * values and has to clear the same bar.
 */

// Vitest runs from the repository root.
const css = readFileSync('src/styles/globals.css', 'utf8')

function tokensIn(block: string): Map<string, Oklch> {
  const tokens = new Map<string, Oklch>()
  for (const match of block.matchAll(/--color-([a-z-]+):\s*(oklch\([^)]*\))/g)) {
    const parsed = parseOklch(match[2]!)
    if (parsed) tokens.set(match[1]!, parsed)
  }
  return tokens
}

function blockAfter(marker: string): string {
  const start = css.indexOf(marker)
  if (start < 0) throw new Error(`stylesheet has no ${marker}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  return css.slice(open, close)
}

const LIGHT = tokensIn(blockAfter('@theme {'))
const DARK = new Map([...LIGHT, ...tokensIn(blockAfter(":root[data-theme='dark']"))])

const THEMES = { light: LIGHT, dark: DARK } as const

function token(theme: keyof typeof THEMES, name: string): Oklch {
  const value = THEMES[theme].get(name)
  if (!value) throw new Error(`no --color-${name} in ${theme}`)
  return value
}

const ratio = (theme: keyof typeof THEMES, fg: string, bg: string) =>
  contrastRatio(token(theme, fg), token(theme, bg))

describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
  describe('focus ring (non-text, 3:1)', () => {
    it.each(['paper', 'paper-elevated', 'paper-sunken'])('is visible on %s', (surface) => {
      // The ring is drawn with --color-focus.
      expect(ratio(theme, 'focus', surface)).toBeGreaterThanOrEqual(3)
    })

    it('is visible on the soft accent surface behind a selected item', () => {
      expect(ratio(theme, 'focus', 'accent-soft')).toBeGreaterThanOrEqual(3)
    })
  })

  describe('field borders (non-text, 3:1)', () => {
    it.each(['paper', 'paper-elevated'])('stand out from %s', (surface) => {
      expect(ratio(theme, 'field', surface)).toBeGreaterThanOrEqual(3)
    })
  })

  describe('text (4.5:1)', () => {
    it.each([
      ['success-ink', 'paper'],
      ['success-ink', 'paper-elevated'],
      ['success-ink', 'success-soft'],
      ['ink', 'paper'],
      ['ink-muted', 'paper'],
      ['ink-muted', 'paper-elevated'],
      ['accent-ink', 'paper'],
      ['accent-ink', 'accent-soft'],
      ['danger', 'paper'],
      ['danger', 'danger-soft'],
      ['warning', 'paper'],
    ])('%s on %s', (fg, bg) => {
      expect(ratio(theme, fg, bg)).toBeGreaterThanOrEqual(4.5)
    })

    it('link colour (accent-ink) reads on the notebook paper the editor sits on', () => {
      expect(ratio(theme, 'accent-ink', 'paper-elevated')).toBeGreaterThanOrEqual(4.5)
    })
  })
})

describe('calendar chips (text, 4.5:1)', () => {
  const kinds = ['midterm', 'assignment', 'class'] as const
  // Hues spread around the wheel: subject colours come from the golden-angle walk.
  const hues = [0, 32, 68, 92, 130, 160, 202, 240, 265, 310, 345]

  for (const theme of ['light', 'dark'] as const) {
    it.each(kinds)(`${theme}: ink on the fill of a %s, at every hue`, (kind) => {
      for (const hue of hues) {
        const paint = eventPaint(hue, kind, theme, false)
        const worst = contrastRatio(
          { l: paint.inkL, c: paint.inkC, h: hue },
          { l: paint.l, c: paint.c, h: hue },
        )
        expect(worst, `${theme} ${kind} hue ${hue}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

describe('text colours chosen in code (4.5:1)', () => {
  const editorTheme = readFileSync('src/components/workspace/editor-theme.ts', 'utf8')

  /** The token a highlight rule paints with, e.g. `{ tag: tags.link, color: 'var(--color-x)' }`. */
  function highlightColor(tag: string): string {
    const rule = new RegExp(`tag: tags\\.${tag},\\s*color: 'var\\(--color-([a-z-]+)`).exec(
      editorTheme,
    )
    if (!rule) throw new Error(`editor theme has no colour for tags.${tag}`)
    return rule[1]!
  }

  describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
    it.each(['link', 'string', 'keyword'])(
      'editor highlight of tags.%s reads on the paper',
      (tag) => {
        expect(ratio(theme, highlightColor(tag), 'paper-elevated')).toBeGreaterThanOrEqual(4.5)
      },
    )
  })

  it('names the ink variants for links and strings, not the fill tokens', () => {
    expect(highlightColor('link')).toBe('accent-ink')
    expect(highlightColor('string')).toBe('success-ink')
  })

  it('never paints text with the --color-success fill (it is a fill, ~3:1 as text)', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`
        if (entry.isDirectory()) walk(path)
        else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          if (/(?<![\w-])text-success(?![\w-])/.test(readFileSync(path, 'utf8')))
            offenders.push(path)
        }
      }
    }
    walk('src')
    expect(offenders).toEqual([])
  })
})
