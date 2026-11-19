import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ACCENTS } from '@/lib/theme/theme'

/**
 * Every accent a student can pick, in both themes, measured from tokens.css:
 * white text on the fill (primary buttons, avatars) and accent-ink as text on
 * the page and on a card. 4.5:1 (WCAG 1.4.3) for all of them.
 */
const css = readFileSync('src/styles/tokens.css', 'utf8')

function block(selector: string): Map<string, string> {
  const start = css.indexOf(selector)
  if (start < 0) throw new Error(`no block for ${selector}`)
  const body = css.slice(css.indexOf('{', start), css.indexOf('}', start))
  const tokens = new Map<string, string>()
  for (const m of body.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(m[1]!, m[2]!)
  }
  return tokens
}

function channel(hex: string, i: number): number {
  const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const lum = (hex: string) =>
  0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2)
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const LIGHT = { paper: '#f3f6fc', card: '#ffffff' }
const DARK = { paper: '#0f1220', card: '#171a2b' }

describe.each(ACCENTS)('accent $label', ({ id }) => {
  it('reads in light', () => {
    const t = block(`:root[data-accent='${id}'],`)
    expect(ratio('#ffffff', t.get('accent')!)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(t.get('accent-ink')!, LIGHT.paper)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(t.get('accent-ink')!, LIGHT.card)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(t.get('accent-ink')!, t.get('accent-soft')!)).toBeGreaterThanOrEqual(4.5)
  })

  it('reads in dark', () => {
    const t = block(`:root[data-theme='dark'][data-accent='${id}'],`)
    expect(ratio('#ffffff', t.get('accent')!)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(t.get('accent-ink')!, DARK.paper)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(t.get('accent-ink')!, DARK.card)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(t.get('accent-ink')!, t.get('accent-soft')!)).toBeGreaterThanOrEqual(4.5)
  })
})
