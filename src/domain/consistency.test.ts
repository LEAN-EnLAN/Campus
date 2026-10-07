import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import { listOrderConflicts, orderConflictOf, orderConflictMessage } from './consistency'
import { computeProgress } from './progress'
import { edge, state, subject } from './test-fixtures'

const SUBJECTS = [
  subject('am1', 'Análisis Matemático I'),
  subject('alg', 'Álgebra'),
  subject('am2', 'Análisis Matemático II'),
]
const EDGES = [
  edge('am2', 'am1', 'to_take'),
  edge('am2', 'alg', 'to_take'),
  edge('am2', 'am1', 'to_pass'),
  edge('am2', 'alg', 'to_pass'),
]

const views = (states: ReturnType<typeof state>[]) =>
  computeSubjectViews({ subjects: SUBJECTS, prerequisites: EDGES, states })

describe('allow-and-flag', () => {
  it('flags Aprobada while requirements are unmet, and names them', () => {
    const v = views([
      state('am1', 'regularized'),
      state('alg', 'regularized'),
      state('am2', 'passed'),
    ])
    const conflict = orderConflictOf(v.find((s) => s.id === 'am2')!)
    expect(conflict).not.toBeNull()
    expect(orderConflictMessage(conflict!)).toBe(
      'El plan indica que todavía te falta aprobar Análisis Matemático I y Álgebra. Si es una equivalencia o excepción, ignorá este aviso.',
    )
  })

  it('does not change or hide the state the student chose', () => {
    const v = views([state('am2', 'passed')])
    expect(v.find((s) => s.id === 'am2')?.status).toBe('passed')
  })

  it('never flags Equivalencia', () => {
    const v = views([state('am2', 'equivalent')])
    expect(orderConflictOf(v.find((s) => s.id === 'am2')!)).toBeNull()
  })

  it('does not flag Regularizada whose only gap is a final prerequisite', () => {
    // Cursada done, correlativas regularizadas: "Final pendiente", fully consistent.
    const v = views([
      state('am1', 'regularized'),
      state('alg', 'regularized'),
      state('am2', 'regularized'),
    ])
    expect(orderConflictOf(v.find((s) => s.id === 'am2')!)).toBeNull()
  })

  it('flags Regularizada when it could not even be taken, asking only for the cursada', () => {
    const v = views([state('am2', 'regularized')])
    const conflict = orderConflictOf(v.find((s) => s.id === 'am2')!)
    expect(orderConflictMessage(conflict!)).toMatch(
      /te falta cursar Análisis Matemático I y Álgebra\./,
    )
  })

  it('does not flag a consistent history', () => {
    const v = views([
      state('am1', 'passed'),
      state('alg', 'equivalent'),
      state('am2', 'passed'),
    ])
    expect(listOrderConflicts(v)).toEqual([])
  })

  it('does not flag anything on a plan with no known correlativas', () => {
    const v = computeSubjectViews({
      subjects: SUBJECTS,
      prerequisites: [],
      states: [state('am2', 'passed')],
      prerequisitesKnown: false,
    })
    expect(listOrderConflicts(v)).toEqual([])
  })

  it('gives each distinct contradiction its own key, so a changed one is shown again', () => {
    const a = orderConflictOf(
      views([state('am1', 'passed'), state('am2', 'passed')]).find((s) => s.id === 'am2')!,
    )!
    const b = orderConflictOf(views([state('am2', 'passed')]).find((s) => s.id === 'am2')!)!
    expect(a.key).not.toBe(b.key)
  })

  it('keeps flagged subjects in the progress count and says how many', () => {
    const v = views([
      state('am1', 'regularized'),
      state('alg', 'regularized'),
      state('am2', 'passed'),
    ])
    const progress = computeProgress(v)
    expect(progress.passed).toBe(1)
    expect(progress.total).toBe(3)
    expect(progress.ratio).toBeCloseTo(1 / 3)
    expect(progress.flagged).toBe(1)
  })
})

describe('progress counts distinct subjects', () => {
  it('never counts one id twice', () => {
    const dup = computeSubjectViews({
      subjects: [subject('x', 'Horas electivas'), subject('x', 'Horas electivas')],
      prerequisites: [],
      states: [],
    })
    expect(computeProgress(dup).total).toBe(1)
  })
})
