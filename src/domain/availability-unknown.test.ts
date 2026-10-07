import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import { edge, state, subject } from './test-fixtures'

/**
 * USR-09 — a plan whose correlativas were never published must not claim that
 * anything is "disponible". Silence about prerequisites is not availability.
 */
describe('a plan with unpublished correlativas', () => {
  const subjects = [subject('a', 'Álgebra'), subject('b', 'Tesina')]

  it('derives a neutral status, never `available`', () => {
    const views = computeSubjectViews({
      subjects,
      prerequisites: [],
      states: [],
      prerequisitesKnown: false,
    })
    expect(views.map((v) => v.status)).toEqual(['pending', 'pending'])
  })

  it('still honours what the student marked', () => {
    const views = computeSubjectViews({
      subjects,
      prerequisites: [],
      states: [state('a', 'in_progress')],
      prerequisitesKnown: false,
    })
    expect(views.find((v) => v.id === 'a')?.status).toBe('in_progress')
    expect(views.find((v) => v.id === 'b')?.status).toBe('pending')
  })

  it('keeps `available` for a plan that KNOWS it has no correlativas', () => {
    const views = computeSubjectViews({
      subjects,
      prerequisites: [],
      states: [],
      prerequisitesKnown: true,
    })
    expect(views.map((v) => v.status)).toEqual(['available', 'available'])
  })

  it('defaults to known, so existing callers keep their behaviour', () => {
    const views = computeSubjectViews({ subjects, prerequisites: [], states: [] })
    expect(views.map((v) => v.status)).toEqual(['available', 'available'])
  })
})

/** USR-10 / EST-12 — elective slots are placeholders, not subjects you can "take" today. */
describe('elective placeholders', () => {
  it('are never derived as `available`', () => {
    const views = computeSubjectViews({
      subjects: [subject('e', 'Electivas 3º nivel', { elective: true }), subject('a')],
      prerequisites: [],
      states: [],
    })
    expect(views.find((v) => v.id === 'e')?.status).toBe('pending')
    expect(views.find((v) => v.id === 'a')?.status).toBe('available')
  })

  it('can still be marked by the student', () => {
    const views = computeSubjectViews({
      subjects: [subject('e', 'Electivas 3º nivel', { elective: true })],
      prerequisites: [],
      states: [state('e', 'passed')],
    })
    expect(views[0]?.status).toBe('passed')
  })
})

describe('two subjects that share a name', () => {
  const twin = [
    subject('h1', 'Horas electivas', { term: '1c', displayOrder: 31, elective: true }),
    subject('h2', 'Horas electivas', { term: '2c', displayOrder: 33, elective: true }),
    subject('t', 'Tesina', { displayOrder: 32 }),
  ]

  it('get distinct display names, without touching the unique ones', () => {
    const views = computeSubjectViews({ subjects: twin, prerequisites: [], states: [] })
    const names = views.map((v) => v.name)
    expect(new Set(names).size).toBe(3)
    expect(names).toEqual([
      'Horas electivas (1° cuatr.)',
      'Horas electivas (2° cuatr.)',
      'Tesina',
    ])
  })

  it('falls back to the plan position when the term does not tell them apart', () => {
    const views = computeSubjectViews({
      subjects: [
        subject('x', 'Optativa', { term: '1c', displayOrder: 5 }),
        subject('y', 'Optativa', { term: '1c', displayOrder: 6 }),
      ],
      prerequisites: [],
      states: [],
    })
    expect(new Set(views.map((v) => v.name)).size).toBe(2)
  })

  it('marking one never marks the other', () => {
    const views = computeSubjectViews({
      subjects: twin,
      prerequisites: [],
      states: [state('h1', 'passed')],
    })
    expect(views.find((v) => v.id === 'h1')?.status).toBe('passed')
    expect(views.find((v) => v.id === 'h2')?.status).not.toBe('passed')
  })
})

describe('requirements carry whether each one is met', () => {
  it('lists every to_take / to_pass edge with its met flag, unmet ones also in missingRequirements', () => {
    const views = computeSubjectViews({
      subjects: [subject('a', 'AM I'), subject('b', 'Álgebra'), subject('c', 'AM II')],
      prerequisites: [
        edge('c', 'a', 'to_take'),
        edge('c', 'b', 'to_take'),
        edge('c', 'a', 'to_pass'),
      ],
      states: [state('a', 'regularized'), state('b', 'passed')],
    })
    const c = views.find((v) => v.id === 'c')!
    expect(c.requirements.map((r) => [r.curriculumSubjectId, r.kind, r.met])).toEqual([
      ['a', 'to_take', true],
      ['b', 'to_take', true],
      ['a', 'to_pass', false],
    ])
    expect(c.missingRequirements.map((r) => [r.curriculumSubjectId, r.kind])).toEqual([
      ['a', 'to_pass'],
    ])
  })

  it('ignores recommended edges: advisory, never listed as a requirement', () => {
    const views = computeSubjectViews({
      subjects: [subject('a'), subject('b')],
      prerequisites: [edge('b', 'a', 'recommended')],
      states: [],
    })
    expect(views.find((v) => v.id === 'b')?.requirements).toEqual([])
  })
})
