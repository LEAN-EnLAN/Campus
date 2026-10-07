import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import { listOrderConflicts } from './consistency'
import { ENTRY_OPTIONS, approveYear, entryValueOf, revertChanges } from './progress-entry'
import { edge, state, subject } from './test-fixtures'

const subjects = [
  subject('a', 'Álgebra', { yearLevel: 1 }),
  subject('b', 'Análisis I', { yearLevel: 1 }),
  subject('c', 'Física I', { yearLevel: 1 }),
  subject('e', 'Horas electivas', { yearLevel: 1, elective: true }),
  subject('d', 'Análisis II', { yearLevel: 2 }),
]

describe('ENTRY_OPTIONS', () => {
  it('offers Sin marcar, Cursando, Regularizada, Aprobada and Equivalencia, in that order', () => {
    expect(ENTRY_OPTIONS.map((o) => o.value)).toEqual([
      null,
      'in_progress',
      'regularized',
      'passed',
      'equivalent',
    ])
    expect(ENTRY_OPTIONS.map((o) => o.label)).toEqual([
      'Sin marcar',
      'Cursando',
      'Regularizada',
      'Aprobada',
      'Equivalencia',
    ])
  })
})

describe('entryValueOf', () => {
  it('maps derived statuses to "Sin marcar" and keeps stored ones', () => {
    expect(entryValueOf('pending')).toBeNull()
    expect(entryValueOf('available')).toBeNull()
    expect(entryValueOf('blocked')).toBeNull()
    expect(entryValueOf('passed')).toBe('passed')
    expect(entryValueOf('failed')).toBe('failed')
  })
})

describe('approveYear', () => {
  const views = computeSubjectViews({
    subjects,
    prerequisites: [],
    states: [state('b', 'passed'), state('c', 'equivalent')],
    prerequisitesKnown: true,
  })

  it('approves every non-elective subject of that year that is not already earned', () => {
    const changes = approveYear(views, 1)
    expect(changes).toEqual([{ subjectId: 'a', from: null, to: 'passed' }])
  })

  it('never overwrites an Equivalencia and never touches another year', () => {
    const ids = approveYear(views, 1).map((c) => c.subjectId)
    expect(ids).not.toContain('c')
    expect(ids).not.toContain('d')
  })

  it('skips elective slots: they are placeholders, not subjects the student passed', () => {
    expect(approveYear(views, 1).map((c) => c.subjectId)).not.toContain('e')
  })

  it('records what each subject was, so the bulk write can be undone', () => {
    const withStates = computeSubjectViews({
      subjects,
      prerequisites: [],
      states: [state('a', 'in_progress'), state('b', 'failed')],
      prerequisitesKnown: true,
    })
    const changes = approveYear(withStates, 1)
    expect(changes.find((c) => c.subjectId === 'a')?.from).toBe('in_progress')
    expect(changes.find((c) => c.subjectId === 'b')?.from).toBe('failed')
    expect(revertChanges(changes)).toEqual(
      changes.map((c) => ({ subjectId: c.subjectId, status: c.from })),
    )
  })

  it('returns nothing when the year does not exist or is already all approved', () => {
    expect(approveYear(views, 7)).toEqual([])
    const all = computeSubjectViews({
      subjects,
      prerequisites: [],
      states: [state('a', 'passed'), state('b', 'passed'), state('c', 'passed')],
      prerequisitesKnown: true,
    })
    expect(approveYear(all, 1)).toEqual([])
  })

  it('is allow-and-flag: approving a year with unmet correlativas is allowed, then flagged', () => {
    const linked = computeSubjectViews({
      subjects: [subject('x', 'Física I'), subject('y', 'Física II', { yearLevel: 2 })],
      prerequisites: [edge('x', 'y', 'to_pass')],
      states: [],
      prerequisitesKnown: true,
    })
    // Year 1 approved before year 2: the plan says x needs y, which is unmarked.
    const after = computeSubjectViews({
      subjects: [subject('x', 'Física I'), subject('y', 'Física II', { yearLevel: 2 })],
      prerequisites: [edge('x', 'y', 'to_pass')],
      states: approveYear(linked, 1).map((c) => state(c.subjectId, 'passed')),
      prerequisitesKnown: true,
    })
    expect(listOrderConflicts(after).map((c) => c.subjectId)).toEqual(['x'])
  })
})
