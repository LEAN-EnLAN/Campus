import { describe, expect, it } from 'vitest'

import { SEED_HUES } from '@/lib/design/palette'

import { emphasisOf, eventPaint, hueForSubject } from './event-paint'

const PLAN = ['algebra', 'analisis', 'fisica', 'algoritmos']

describe('hueForSubject', () => {
  it('gives every subject in a plan its own hue', () => {
    const hues = PLAN.map((id) => hueForSubject(id, PLAN))
    expect(new Set(hues).size).toBe(PLAN.length)
  })

  it('is stable: the same subject is always the same colour', () => {
    expect(hueForSubject('fisica', PLAN)).toBe(hueForSubject('fisica', PLAN))
  })

  it('falls back to the accent for an item with no subject', () => {
    expect(hueForSubject(null, PLAN)).toBe(SEED_HUES.tropicalTeal)
  })

  it('falls back to the accent for a subject the plan does not contain', () => {
    // A vault can hold an item pointing at a subject from a plan the student
    // has since changed. Colouring it by a missing index would be a crash or,
    // worse, silently the same colour as subject zero.
    expect(hueForSubject('materia-de-otro-plan', PLAN)).toBe(SEED_HUES.tropicalTeal)
  })
})

describe('emphasisOf', () => {
  it('puts what you can fail at the top', () => {
    expect(emphasisOf('midterm')).toBe('strong')
    expect(emphasisOf('final')).toBe('strong')
  })

  it('puts what you hand in in the middle', () => {
    expect(emphasisOf('assignment')).toBe('medium')
    expect(emphasisOf('task')).toBe('medium')
  })

  it('lets the recurring and the incidental recede', () => {
    expect(emphasisOf('class')).toBe('quiet')
    expect(emphasisOf('custom')).toBe('quiet')
    expect(emphasisOf('registration')).toBe('medium')
  })
})

describe('eventPaint', () => {
  const hue = 200

  it('keeps one subject to ONE hue across every kind of event', () => {
    // This is the whole request: colour says WHICH SUBJECT, and only the
    // shade says how much it matters. Two events of the same subject in two
    // different hues would make the colour mean nothing.
    const kinds = ['midterm', 'assignment', 'class'] as const
    const hues = kinds.map((k) => eventPaint(hue, k, 'light', false).hue)

    expect(new Set(hues)).toEqual(new Set([hue]))
  })

  it('separates the three emphases by lightness, not by colour', () => {
    const strong = eventPaint(hue, 'final', 'light', false)
    const medium = eventPaint(hue, 'assignment', 'light', false)
    const quiet = eventPaint(hue, 'class', 'light', false)

    expect(strong.l).toBeLessThan(medium.l)
    expect(medium.l).toBeLessThan(quiet.l)
  })

  it('gives every fill an ink that is far enough from it to read', () => {
    for (const kind of ['midterm', 'assignment', 'class'] as const) {
      for (const theme of ['light', 'dark'] as const) {
        const paint = eventPaint(hue, kind, theme, false)
        expect(Math.abs(paint.l - paint.inkL)).toBeGreaterThan(30)
      }
    }
  })

  it('lifts the fills in the dark theme instead of keeping the day values', () => {
    expect(eventPaint(hue, 'class', 'dark', false).l).toBeLessThan(
      eventPaint(hue, 'class', 'light', false).l,
    )
  })

  it('does not use colour to say "done" — that is what the strike-through is for', () => {
    const open = eventPaint(hue, 'final', 'light', false)
    const done = eventPaint(hue, 'final', 'light', true)

    expect(done.hue).toBe(open.hue)
    expect(done.l).toBe(open.l)
  })
})
