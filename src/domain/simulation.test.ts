import { describe, expect, it } from 'vitest'

import { computeSubjectViews, type AvailabilityInput } from './availability'
import {
  applyHypotheses,
  filterByTerm,
  simulateViews,
  simulationDiff,
  termsInPlan,
  type Hypotheses,
} from './simulation'
import { edge, state, subject } from './test-fixtures'
import type { StoredSubjectStatus } from './types'

const SUBJECTS = [
  subject('am1', 'Análisis Matemático I', { yearLevel: 1, term: '1c', displayOrder: 1 }),
  subject('alg', 'Álgebra', { yearLevel: 1, term: '1c', displayOrder: 2 }),
  subject('am2', 'Análisis Matemático II', { yearLevel: 1, term: '2c', displayOrder: 3 }),
  subject('so', 'Sistemas Operativos', { yearLevel: 2, term: 'anual', displayOrder: 4 }),
  subject('redes', 'Redes de Datos', { yearLevel: 3, term: '2c', displayOrder: 5 }),
]

const EDGES = [
  edge('am2', 'am1', 'to_take'),
  edge('am2', 'alg', 'to_take'),
  edge('am2', 'am1', 'to_pass'),
  edge('redes', 'so', 'to_take'),
  edge('redes', 'so', 'to_pass'),
]

function input(statuses: Record<string, StoredSubjectStatus>): AvailabilityInput {
  return {
    subjects: SUBJECTS,
    prerequisites: EDGES,
    states: Object.entries(statuses).map(([id, s]) => state(id, s)),
  }
}

const hyp = (entries: [string, StoredSubjectStatus | null][]): Hypotheses => new Map(entries)
const ids = (list: { id: string }[]) => list.map((v) => v.id)

describe('applyHypotheses', () => {
  it('overrides, adds and clears without touching the real states', () => {
    const real = [state('am1', 'regularized'), state('alg', 'in_progress')]
    const frozen = structuredClone(real)
    const out = applyHypotheses(
      real,
      hyp([
        ['am1', 'passed'],
        ['alg', null],
        ['so', 'regularized'],
      ]),
    )
    expect(out.map((s) => [s.curriculumSubjectId, s.status])).toEqual([
      ['am1', 'passed'],
      ['so', 'regularized'],
    ])
    expect(real).toEqual(frozen)
  })
})

describe('simulationDiff', () => {
  it('lists the cursadas a hypothesis opens', () => {
    const base = input({ am1: 'regularized' })
    const real = computeSubjectViews(base)
    const simulated = simulateViews(
      base,
      hyp([
        ['alg', 'regularized'],
        ['so', 'regularized'],
      ]),
    )
    const diff = simulationDiff(real, simulated)
    expect(ids(diff.cursar)).toEqual(['am2', 'redes'])
    expect(diff.rendir).toEqual([])
    expect(diff.closes).toEqual([])
  })

  it('lists the finals a hypothesis makes rendible', () => {
    const base = input({ am1: 'regularized', alg: 'passed', am2: 'regularized' })
    const real = computeSubjectViews(base)
    expect(real.find((v) => v.id === 'am2')!.missingRequirements).toHaveLength(1)
    const diff = simulationDiff(real, simulateViews(base, hyp([['am1', 'passed']])))
    expect(ids(diff.rendir)).toEqual(['am2'])
    expect(diff.cursar).toEqual([])
  })

  it('reports what a status taken back would close', () => {
    const base = input({ am1: 'regularized', alg: 'regularized' })
    const real = computeSubjectViews(base)
    const diff = simulationDiff(real, simulateViews(base, hyp([['alg', null]])))
    expect(ids(diff.closes)).toEqual(['am2'])
    expect(diff.closes[0]!.status).toBe('blocked')
  })

  it('is empty without hypotheses', () => {
    const base = input({ am1: 'regularized' })
    const diff = simulationDiff(computeSubjectViews(base), simulateViews(base, hyp([])))
    expect(diff).toEqual({ cursar: [], rendir: [], closes: [] })
  })

  it('never lists the subject the student imagines changing', () => {
    const base = input({ am1: 'regularized', alg: 'regularized' })
    const diff = simulationDiff(
      computeSubjectViews(base),
      simulateViews(base, hyp([['am2', 'in_progress']])),
    )
    expect(diff).toEqual({ cursar: [], rendir: [], closes: [] })
  })
})

describe('term filter', () => {
  it('filters by cuatrimestre and lists the terms in calendar order', () => {
    const views = computeSubjectViews(input({}))
    expect(termsInPlan(views)).toEqual(['1c', '2c', 'anual'])
    expect(ids(filterByTerm(views, '2c'))).toEqual(['am2', 'redes'])
    expect(filterByTerm(views, 'all')).toHaveLength(5)
  })
})
