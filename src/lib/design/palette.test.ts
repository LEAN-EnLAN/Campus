import { describe, expect, it } from 'vitest'

import {
  ACCENT_HUE,
  clampToHarmony,
  HARMONY,
  harmonic,
  SEED_HUES,
  subjectHue,
  toCss,
} from './palette'

describe('the harmony envelope', () => {
  it('keeps every generated surface inside the chroma ceiling', () => {
    for (let hue = 0; hue < 360; hue += 7) {
      for (const role of ['subject', 'soft', 'ink'] as const) {
        for (const theme of ['light', 'dark'] as const) {
          expect(harmonic(hue, role, theme).c).toBeLessThanOrEqual(HARMONY.maxChroma)
        }
      }
    }
  })

  it('lands on the real Tropical Teal when asked for its hue', () => {
    // The envelope is not invented: it is read off the palette. If a generated
    // subject colour at teal's hue drifted far from the seed, the numbers would
    // no longer describe the set they came from.
    const generated = harmonic(SEED_HUES.tropicalTeal, 'subject', 'light')

    expect(generated.l).toBeGreaterThan(70)
    expect(generated.l).toBeLessThan(82)
    expect(generated.c).toBeCloseTo(0.065, 1)
  })

  it('lifts subject colours in the dark theme so they still read', () => {
    const day = harmonic(200, 'subject', 'light')
    const night = harmonic(200, 'subject', 'dark')

    // A colour tuned to sit on Linen disappears on Shadow Grey. Same hue, same
    // family, different lightness — that is the whole trick.
    expect(night.l).not.toBe(day.l)
    expect(night.l).toBeGreaterThan(60)
  })

  it('keeps soft surfaces far lighter than the ink that sits on them', () => {
    for (const theme of ['light', 'dark'] as const) {
      const soft = harmonic(120, 'soft', theme)
      const ink = harmonic(120, 'ink', theme)
      expect(Math.abs(soft.l - ink.l)).toBeGreaterThan(35)
    }
  })
})

describe('clampToHarmony — the only gate the colour picker has', () => {
  it('pulls an over-saturated colour back to the ceiling', () => {
    // A student pasting #ff0000 is asking for something this system does not
    // have. It answers with the nearest colour it DOES have rather than
    // refusing, because refusing teaches nothing.
    const clamped = clampToHarmony({ l: 55, c: 0.31, h: 29 })

    expect(clamped.c).toBe(HARMONY.maxChroma)
  })

  it('respects the hue: intensity is limited, the colour is not overridden', () => {
    expect(clampToHarmony({ l: 55, c: 0.31, h: 29 }).h).toBe(29)
    expect(clampToHarmony({ l: 10, c: 0.01, h: 300 }).h).toBe(300)
  })

  it('pulls lightness into the band so nothing is unreadable on paper', () => {
    expect(clampToHarmony({ l: 4, c: 0.05, h: 200 }).l).toBeGreaterThanOrEqual(HARMONY.minL)
    expect(clampToHarmony({ l: 99, c: 0.05, h: 200 }).l).toBeLessThanOrEqual(HARMONY.maxL)
  })

  it('leaves a colour that is already in harmony completely alone', () => {
    const inside = { l: 76, c: 0.065, h: 202 }
    expect(clampToHarmony(inside)).toEqual(inside)
  })

  it('does not let the accent hue smuggle the accent chroma through', () => {
    // Tomato Jam sits at twice the chroma of the rest of the set. It is the one
    // loud voice and it is spent on the accent — a SUBJECT painted that loud
    // would compete with every selected state in the app.
    expect(clampToHarmony({ l: 55, c: 0.158, h: ACCENT_HUE }).c).toBe(HARMONY.maxChroma)
  })
})

describe('subjectHue — colours that stay apart', () => {
  it('separates consecutive subjects widely', () => {
    for (let i = 0; i < 40; i += 1) {
      const gap = Math.abs(subjectHue(i) - subjectHue(i + 1))
      const wrapped = Math.min(gap, 360 - gap)
      expect(wrapped).toBeGreaterThan(45)
    }
  })

  it('never repeats a hue across a whole degree plan', () => {
    // Forty subjects is a real plan. Two of them sharing a colour makes the
    // colour meaningless exactly when the board is fullest.
    const hues = Array.from({ length: 40 }, (_, i) => Math.round(subjectHue(i)))
    expect(new Set(hues).size).toBe(40)
  })

  it('is stable: the same index is always the same hue', () => {
    expect(subjectHue(7)).toBe(subjectHue(7))
  })
})

describe('toCss', () => {
  it('emits oklch a browser understands', () => {
    expect(toCss({ l: 76, c: 0.065, h: 202 })).toBe('oklch(76% 0.065 202)')
  })
})
