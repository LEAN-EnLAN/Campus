import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import { dependentLine, finalDependents, opensLabel, pendingFinals } from './pending-finals'
import { edge, state, subject } from './test-fixtures'
import type { StoredSubjectStatus } from './types'

/**
 * A small plan shaped like UTN's: each correlativa appears twice, regularizada
 * to cursar (`to_take`) and aprobada to rendir (`to_pass`).
 *
 *   am1 ─┬─> am2 ──> mat-sup
 *   alg ─┘          ^
 *   fis1 ──> fis2   |  (mat-sup also needs alg aprobada)
 */
const SUBJECTS = [
  subject('am1', 'Análisis Matemático I', { yearLevel: 1, displayOrder: 1 }),
  subject('alg', 'Álgebra', { yearLevel: 1, displayOrder: 2 }),
  subject('fis1', 'Física I', { yearLevel: 1, displayOrder: 3 }),
  subject('am2', 'Análisis Matemático II', { yearLevel: 2, displayOrder: 4 }),
  subject('fis2', 'Física II', { yearLevel: 2, displayOrder: 5 }),
  subject('mat-sup', 'Matemática Superior', { yearLevel: 3, displayOrder: 6 }),
]

const twice = (from: string, requires: string) => [
  edge(from, requires, 'to_take'),
  edge(from, requires, 'to_pass'),
]

const EDGES = [
  ...twice('am2', 'am1'),
  ...twice('am2', 'alg'),
  ...twice('fis2', 'fis1'),
  ...twice('mat-sup', 'am2'),
  edge('mat-sup', 'alg', 'to_pass'),
]

function views(statuses: Record<string, StoredSubjectStatus>, prerequisitesKnown = true) {
  return computeSubjectViews({
    subjects: SUBJECTS,
    prerequisites: prerequisitesKnown ? EDGES : [],
    states: Object.entries(statuses).map(([id, s]) => state(id, s)),
    prerequisitesKnown,
  })
}

describe('pendingFinals', () => {
  it('lists only regularizadas, most dependents first', () => {
    const list = pendingFinals(
      views({
        am1: 'regularized',
        alg: 'regularized',
        fis1: 'regularized',
        am2: 'in_progress',
      }),
    )
    // alg's final is asked for by am2 AND mat-sup; am1 and fis1 by one each.
    expect(list.map((p) => p.subject.id)).toEqual(['alg', 'am1', 'fis1'])
    expect(list.map((p) => p.opens.length)).toEqual([2, 1, 1])
  })

  it('breaks ties by plan order (year, then display order)', () => {
    const list = pendingFinals(views({ fis1: 'regularized', am1: 'regularized' }))
    expect(list.map((p) => p.subject.id)).toEqual(['am1', 'fis1'])
  })

  it('does not credit the final with what the cursada already opened', () => {
    // am1 regularizada already satisfies am2's `to_take`, so `unlocks` lists am2.
    // What passing am1 adds is am2's FINAL, which is the dependent counted here.
    const v = views({ am1: 'regularized' })
    const am1 = v.find((s) => s.id === 'am1')!
    expect(am1.unlocks).toEqual(['am2'])
    expect(finalDependents('am1', v).map((d) => d.subject.id)).toEqual(['am2'])
  })

  it('skips dependents the student already approved', () => {
    const list = pendingFinals(views({ alg: 'regularized', am2: 'passed' }))
    expect(list[0]!.opens.map((d) => d.subject.id)).toEqual(['mat-sup'])
  })

  it('says what else a dependent final still waits on', () => {
    const [alg] = pendingFinals(views({ alg: 'regularized' }))
    const am2 = alg!.opens.find((d) => d.subject.id === 'am2')!
    expect(am2.alsoNeeds).toEqual(['Análisis Matemático I'])
    expect(dependentLine(am2)).toBe(
      'Análisis Matemático II (también pide Análisis Matemático I)',
    )
  })

  it('claims no dependents when the plan publishes no correlativas', () => {
    const list = pendingFinals(views({ am1: 'regularized', alg: 'regularized' }, false))
    expect(list.map((p) => p.opens.length)).toEqual([0, 0])
    expect(list.map((p) => p.subject.id)).toEqual(['am1', 'alg'])
  })

  it('is empty without regularizadas', () => {
    expect(pendingFinals(views({ am1: 'passed', alg: 'in_progress' }))).toEqual([])
  })
})

describe('opensLabel', () => {
  it('agrees in number', () => {
    expect(opensLabel(1)).toBe('Habilita 1 materia')
    expect(opensLabel(3)).toBe('Habilita 3 materias')
  })
})
