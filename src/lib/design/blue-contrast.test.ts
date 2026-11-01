import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * WCAG contrast of the palette users actually see: the Campus Blue token block
 * in tokens.css (`:is(.campus-blue, .blue-onboarding, .blue-startup)`).
 * tokens-contrast.test.ts measures the warm oklch base layer; this measures what ships.
 *
 *   4.5:1 text (1.4.3) · 3:1 focus ring and control borders (1.4.11)
 */
const css = readFileSync('src/styles/tokens.css', 'utf8')
const block = (() => {
  const start = css.indexOf(':is(.campus-blue, .blue-onboarding, .blue-startup) {')
  if (start < 0) throw new Error('tokens.css has no Campus Blue block')
  return css.slice(start, css.indexOf('\n}', start))
})()

const tokens = new Map<string, string>()
for (const m of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  tokens.set(m[1]!, m[2]!)
}

// Aliases such as `--color-focus: var(--color-accent)`.
for (const m of block.matchAll(/--color-([a-z-]+):\s*var\(--color-([a-z-]+)\)\s*;/g)) {
  const target = tokens.get(m[2]!)
  if (target) tokens.set(m[1]!, target)
}

function channel(hex: string, i: number): number {
  const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const lum = (hex: string) =>
  0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2)

function ratio(fg: string, bg: string): number {
  const f = tokens.get(fg)
  const b = tokens.get(bg)
  if (!f || !b) throw new Error(`token missing: ${f ? bg : fg}`)
  const [hi, lo] = [lum(f), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe('Campus Blue palette', () => {
  it('declares the tokens it is measured on', () => {
    for (const name of ['paper', 'ink', 'accent', 'focus', 'field', 'shell']) {
      expect(tokens.has(name), name).toBe(true)
    }
  })

  describe('text (4.5:1)', () => {
    it.each([
      ['ink', 'paper'],
      ['ink', 'paper-elevated'],
      ['ink', 'paper-sunken'],
      ['ink', 'accent-soft'],
      ['ink-muted', 'paper'],
      ['ink-muted', 'paper-elevated'],
      ['ink-muted', 'paper-sunken'],
      ['accent-ink', 'paper'],
      ['accent-ink', 'paper-elevated'],
      ['accent-ink', 'accent-soft'],
      ['on-tint', 'accent'],
      ['on-tint', 'accent-hover'],
      ['success-ink', 'paper-elevated'],
      ['success-ink', 'success-soft'],
      ['danger', 'paper-elevated'],
      ['danger', 'danger-soft'],
      ['warning', 'paper-elevated'],
      ['warning', 'warning-soft'],
      ['shell-ink', 'shell'],
      ['shell-ink-muted', 'shell'],
    ])('%s on %s', (fg, bg) => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5)
    })
  })

  describe('non-text (3:1)', () => {
    it.each(['paper', 'paper-elevated', 'paper-sunken', 'accent-soft'])(
      'focus ring is visible on %s',
      (bg) => {
        expect(ratio('focus', bg)).toBeGreaterThanOrEqual(3)
      },
    )
    it.each(['paper', 'paper-elevated'])('field borders stand out from %s', (bg) => {
      expect(ratio('field', bg)).toBeGreaterThanOrEqual(3)
    })
  })
})
