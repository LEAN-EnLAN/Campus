import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import { activeSubjects, computeProgress } from './progress'
import {
  manualProblem,
  manualStates,
  manualToCurriculumSubject,
  MANUAL_CURRICULUM_ID,
} from './manual-subjects'
import { edge, subject } from './test-fixtures'
import type { ManualSubject } from './types'

const manual = (over: Partial<ManualSubject> = {}): ManualSubject => ({
  id: 'm1',
  name: 'Cálculo 1',
  yearLevel: 1,
  term: '1c',
  status: null,
  grade: null,
  ...over,
})

describe('manualToCurriculumSubject', () => {
  it('produces a plan subject that is flagged manual, with no code or credits', () => {
    const s = manualToCurriculumSubject(manual(), 0)
    expect(s).toMatchObject({
      id: 'm1',
      curriculumId: MANUAL_CURRICULUM_ID,
      name: 'Cálculo 1',
      yearLevel: 1,
      term: '1c',
      code: null,
      credits: null,
      elective: false,
      manual: true,
    })
  })

  it('keeps creation order through displayOrder', () => {
    const a = manualToCurriculumSubject(manual({ id: 'a' }), 0)
    const b = manualToCurriculumSubject(manual({ id: 'b' }), 1)
    expect(a.displayOrder).toBeLessThan(b.displayOrder)
  })
})

describe('manualStates', () => {
  it('keeps only subjects the student marked, with their grade', () => {
    const states = manualStates([
      manual({ id: 'a' }),
      manual({ id: 'b', status: 'passed', grade: 8 }),
    ])
    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({ curriculumSubjectId: 'b', status: 'passed', grade: 8 })
  })
})

describe('manual subjects never carry an availability or correlativa claim', () => {
  const subjects = [manualToCurriculumSubject(manual(), 0)]

  it('an unmarked manual subject is "pending", even when the plan is declared known', () => {
    const [view] = computeSubjectViews({
      subjects,
      prerequisites: [],
      states: [],
      prerequisitesKnown: true,
    })
    expect(view!.status).toBe('pending')
    expect(view!.missingRequirements).toEqual([])
    expect(view!.requirements).toEqual([])
    expect(view!.unlocks).toEqual([])
  })

  it('is never blocked, even if a stray edge points at it', () => {
    const views = computeSubjectViews({
      subjects: [subject('x', 'Catálogo'), ...subjects],
      prerequisites: [edge('m1', 'x', 'to_take')],
      states: [],
      prerequisitesKnown: true,
    })
    expect(views.find((v) => v.id === 'm1')!.status).toBe('pending')
  })

  it('honours the status the student set', () => {
    const [view] = computeSubjectViews({
      subjects,
      prerequisites: [],
      states: manualStates([manual({ status: 'in_progress' })]),
      prerequisitesKnown: false,
    })
    expect(view!.status).toBe('in_progress')
  })

  it('counts "X de Y que cargaste": totals are only what was entered', () => {
    const views = computeSubjectViews({
      subjects: [
        manualToCurriculumSubject(manual({ id: 'a' }), 0),
        manualToCurriculumSubject(manual({ id: 'b' }), 1),
      ],
      prerequisites: [],
      states: manualStates([manual({ id: 'a', status: 'passed' })]),
      prerequisitesKnown: false,
    })
    const progress = computeProgress(views)
    expect([progress.passed, progress.total, progress.available, progress.blocked]).toEqual([
      1, 2, 0, 0,
    ])
  })
})

describe('manualProblem', () => {
  it('accepts a normal subject', () => {
    expect(manualProblem({ name: 'Cálculo 1', yearLevel: 2, term: 'anual' })).toBeNull()
  })

  it('asks for a name', () => {
    expect(manualProblem({ name: '   ', yearLevel: 1, term: '1c' })).toMatch(/nombre/i)
  })

  it('rejects a name longer than the database allows', () => {
    expect(manualProblem({ name: 'x'.repeat(201), yearLevel: 1, term: '1c' })).toMatch(/200/)
  })

  it('rejects a year outside 1-10 or fractional', () => {
    expect(manualProblem({ name: 'A', yearLevel: 0, term: '1c' })).toMatch(/año/i)
    expect(manualProblem({ name: 'A', yearLevel: 11, term: '1c' })).toMatch(/año/i)
    expect(manualProblem({ name: 'A', yearLevel: 1.5, term: '1c' })).toMatch(/año/i)
  })

  it('rejects an unknown cuatrimestre', () => {
    expect(manualProblem({ name: 'A', yearLevel: 1, term: 'verano' as never })).toMatch(
      /cuatrimestre/i,
    )
  })
})

describe('manual subjects in Hoy', () => {
  it('a manual subject marked Cursando is an active subject, one marked Aprobada is not', () => {
    const views = computeSubjectViews({
      subjects: [
        manualToCurriculumSubject(manual({ id: 'a', name: 'A' }), 0),
        manualToCurriculumSubject(manual({ id: 'b', name: 'B' }), 1),
        manualToCurriculumSubject(manual({ id: 'c', name: 'C' }), 2),
      ],
      prerequisites: [],
      states: manualStates([
        manual({ id: 'a', status: 'in_progress' }),
        manual({ id: 'b', status: 'passed' }),
      ]),
      prerequisitesKnown: false,
    })
    expect(activeSubjects(views).map((v) => v.name)).toEqual(['A'])
  })
})
