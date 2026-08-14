import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import { activeSubjects, computeProgress } from './progress'
import type { CurriculumSubject, SubjectView, UserSubjectState } from './types'

function subject(id: string, credits: number | null = null): CurriculumSubject {
  return {
    id,
    curriculumId: 'cur-1',
    subjectId: `s-${id}`,
    code: null,
    name: id.toUpperCase(),
    normalizedName: id,
    yearLevel: 1,
    term: 'anual',
    credits,
    elective: false,
    displayOrder: 0,
  }
}

function state(id: string, status: UserSubjectState['status']): UserSubjectState {
  return {
    curriculumSubjectId: id,
    status,
    grade: null,
    startedAt: null,
    completedAt: null,
    notes: null,
  }
}

function views(subjects: CurriculumSubject[], states: UserSubjectState[] = []): SubjectView[] {
  return computeSubjectViews({ subjects, prerequisites: [], states })
}

describe('computeProgress', () => {
  it('returns a zeroed summary for an empty curriculum without dividing by zero', () => {
    const summary = computeProgress([])
    expect(summary.total).toBe(0)
    expect(summary.ratio).toBe(0)
    expect(Number.isNaN(summary.ratio)).toBe(false)
  })

  it('counts each status bucket', () => {
    const summary = computeProgress(
      views(
        [subject('a'), subject('b'), subject('c'), subject('d')],
        [state('a', 'passed'), state('b', 'in_progress'), state('c', 'failed')],
      ),
    )

    expect(summary.total).toBe(4)
    expect(summary.passed).toBe(1)
    expect(summary.inProgress).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.available).toBe(1)
  })

  it('counts equivalencias toward progress alongside passed', () => {
    const summary = computeProgress(
      views(
        [subject('a'), subject('b'), subject('c'), subject('d')],
        [state('a', 'passed'), state('b', 'equivalent')],
      ),
    )
    expect(summary.ratio).toBeCloseTo(0.5)
  })

  it('does not count regularizada as finished', () => {
    const summary = computeProgress(
      views([subject('a'), subject('b')], [state('a', 'regularized')]),
    )
    expect(summary.regularized).toBe(1)
    expect(summary.ratio).toBe(0)
  })

  it('reports credits only when every subject declares them', () => {
    const complete = computeProgress(
      views([subject('a', 6), subject('b', 4)], [state('a', 'passed')]),
    )
    expect(complete.creditsEarned).toBe(6)
    expect(complete.creditsTotal).toBe(10)

    const partial = computeProgress(
      views([subject('a', 6), subject('b', null)], [state('a', 'passed')]),
    )
    // A partial total understates the plan — better to report nothing.
    expect(partial.creditsEarned).toBeNull()
    expect(partial.creditsTotal).toBeNull()
  })
})

describe('activeSubjects', () => {
  it('returns subjects being cursadas or already regularizadas', () => {
    const active = activeSubjects(
      views(
        [subject('a'), subject('b'), subject('c'), subject('d')],
        [state('a', 'in_progress'), state('b', 'regularized'), state('c', 'passed')],
      ),
    )
    expect(active.map((v) => v.id).sort()).toEqual(['a', 'b'])
  })
})
