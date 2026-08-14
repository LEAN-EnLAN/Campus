import { describe, expect, it } from 'vitest'

import { computeSubjectViews, groupByYear, newlyUnlocked } from './availability'
import type { CurriculumSubject, PrerequisiteEdge, UserSubjectState } from './types'

function subject(
  id: string,
  name: string,
  yearLevel = 1,
  overrides: Partial<CurriculumSubject> = {},
): CurriculumSubject {
  return {
    id,
    curriculumId: 'cur-1',
    subjectId: `s-${id}`,
    code: null,
    name,
    normalizedName: name.toLowerCase(),
    yearLevel,
    term: 'anual',
    credits: null,
    elective: false,
    displayOrder: 0,
    ...overrides,
  }
}

function edge(
  from: string,
  requires: string,
  kind: PrerequisiteEdge['kind'] = 'to_take',
): PrerequisiteEdge {
  return {
    curriculumSubjectId: from,
    requiredCurriculumSubjectId: requires,
    kind,
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

describe('computeSubjectViews', () => {
  it('marks a subject with no prerequisites as available', () => {
    const views = computeSubjectViews({
      subjects: [subject('a', 'Álgebra')],
      prerequisites: [],
      states: [],
    })

    expect(views[0]?.status).toBe('available')
    expect(views[0]?.missingRequirements).toEqual([])
  })

  it('blocks a subject whose to_take prerequisite is untouched', () => {
    const views = computeSubjectViews({
      subjects: [subject('a', 'Análisis I'), subject('b', 'Análisis II', 2)],
      prerequisites: [edge('b', 'a')],
      states: [],
    })

    const b = views.find((v) => v.id === 'b')
    expect(b?.status).toBe('blocked')
    expect(b?.missingRequirements).toEqual([
      { curriculumSubjectId: 'a', name: 'Análisis I', kind: 'to_take', needs: 'cursar' },
    ])
  })

  // CAP-PLAN-002 — the requirement this whole module exists for.
  it('recalculates dependants when the prerequisite is marked passed', () => {
    const subjects = [subject('a', 'Análisis I'), subject('b', 'Análisis II', 2)]
    const prerequisites = [edge('b', 'a')]

    const before = computeSubjectViews({ subjects, prerequisites, states: [] })
    const after = computeSubjectViews({
      subjects,
      prerequisites,
      states: [state('a', 'passed')],
    })

    expect(before.find((v) => v.id === 'b')?.status).toBe('blocked')
    expect(after.find((v) => v.id === 'b')?.status).toBe('available')
    expect(newlyUnlocked(before, after).map((v) => v.id)).toEqual(['b'])
  })

  it('accepts a regularized prerequisite for cursar but not for rendir', () => {
    const subjects = [subject('a', 'Física I'), subject('b', 'Física II', 2)]
    const states = [state('a', 'regularized')]

    const toTake = computeSubjectViews({
      subjects,
      prerequisites: [edge('b', 'a', 'to_take')],
      states,
    })
    const toPass = computeSubjectViews({
      subjects,
      prerequisites: [edge('b', 'a', 'to_pass')],
      states,
    })

    expect(toTake.find((v) => v.id === 'b')?.status).toBe('available')
    // A to_pass gap does not block the cursada — it is surfaced, not enforced.
    expect(toPass.find((v) => v.id === 'b')?.status).toBe('available')
    expect(toPass.find((v) => v.id === 'b')?.missingRequirements).toHaveLength(1)
    expect(toPass.find((v) => v.id === 'b')?.missingRequirements[0]?.needs).toBe('aprobar')
  })

  it('treats an equivalencia as satisfying both kinds of correlativa', () => {
    const views = computeSubjectViews({
      subjects: [subject('a', 'Química'), subject('b', 'Química II', 2)],
      prerequisites: [edge('b', 'a', 'to_pass')],
      states: [state('a', 'equivalent')],
    })

    expect(views.find((v) => v.id === 'b')?.missingRequirements).toEqual([])
  })

  it('never lets a recommended prerequisite block anything', () => {
    const views = computeSubjectViews({
      subjects: [subject('a', 'Inglés I'), subject('b', 'Inglés II', 2)],
      prerequisites: [edge('b', 'a', 'recommended')],
      states: [],
    })

    expect(views.find((v) => v.id === 'b')?.status).toBe('available')
    expect(views.find((v) => v.id === 'b')?.missingRequirements).toEqual([])
  })

  it('keeps a stored status even when correlativas disagree', () => {
    // The student says they are cursando. Our seed says blocked. The student wins;
    // we surface the conflict rather than overwriting their reality.
    const views = computeSubjectViews({
      subjects: [subject('a', 'Álgebra'), subject('b', 'Sintaxis', 2)],
      prerequisites: [edge('b', 'a')],
      states: [state('b', 'in_progress')],
    })

    const b = views.find((v) => v.id === 'b')
    expect(b?.status).toBe('in_progress')
    expect(b?.missingRequirements).toHaveLength(1)
  })

  it('ignores dangling prerequisite edges instead of blocking on them', () => {
    // A bad seed row pointing outside the curriculum must not freeze a student's plan.
    const views = computeSubjectViews({
      subjects: [subject('a', 'Álgebra')],
      prerequisites: [edge('a', 'ghost')],
      states: [],
    })

    expect(views[0]?.status).toBe('available')
  })

  it('reports what a subject unlocks, excluding recommendations', () => {
    const views = computeSubjectViews({
      subjects: [
        subject('a', 'Álgebra'),
        subject('b', 'Sintaxis', 2),
        subject('c', 'Paradigmas', 2),
      ],
      prerequisites: [edge('b', 'a'), edge('c', 'a', 'recommended')],
      states: [],
    })

    expect(views.find((v) => v.id === 'a')?.unlocks).toEqual(['b'])
  })

  // UTN's Ordenanza declares each correlativa under one "PARA CURSAR Y RENDIR"
  // heading, which the seed emits as a to_take edge AND a to_pass edge. Listing the
  // dependent once per edge duplicated it in the UI and duplicated the React key.
  it('does not list a dependant twice when it is both a to_take and a to_pass correlativa', () => {
    const views = computeSubjectViews({
      subjects: [subject('a', 'Análisis I'), subject('b', 'Análisis II', 2)],
      prerequisites: [edge('b', 'a', 'to_take'), edge('b', 'a', 'to_pass')],
      states: [],
    })

    expect(views.find((v) => v.id === 'a')?.unlocks).toEqual(['b'])
  })

  it('does not claim a to_pass-only correlativa unlocks anything', () => {
    // B was never blocked by A for cursar, so saying A "habilita" B would be false.
    const views = computeSubjectViews({
      subjects: [subject('a', 'Álgebra'), subject('b', 'Sintaxis', 2)],
      prerequisites: [edge('b', 'a', 'to_pass')],
      states: [],
    })

    expect(views.find((v) => v.id === 'b')?.status).toBe('available')
    expect(views.find((v) => v.id === 'a')?.unlocks).toEqual([])
  })

  it('handles a three-level chain transitively through stored state', () => {
    const subjects = [subject('a', 'AM I'), subject('b', 'AM II', 2), subject('c', 'AM III', 3)]
    const prerequisites = [edge('b', 'a'), edge('c', 'b')]

    const afterA = computeSubjectViews({
      subjects,
      prerequisites,
      states: [state('a', 'passed')],
    })
    expect(afterA.find((v) => v.id === 'b')?.status).toBe('available')
    expect(afterA.find((v) => v.id === 'c')?.status).toBe('blocked')

    const afterB = computeSubjectViews({
      subjects,
      prerequisites,
      states: [state('a', 'passed'), state('b', 'passed')],
    })
    expect(afterB.find((v) => v.id === 'c')?.status).toBe('available')
  })

  it('blocks when any one of several to_take prerequisites is missing', () => {
    const views = computeSubjectViews({
      subjects: [subject('a', 'A'), subject('b', 'B'), subject('c', 'C', 2)],
      prerequisites: [edge('c', 'a'), edge('c', 'b')],
      states: [state('a', 'passed')],
    })

    const c = views.find((v) => v.id === 'c')
    expect(c?.status).toBe('blocked')
    expect(c?.missingRequirements.map((m) => m.name)).toEqual(['B'])
  })

  it('is deterministic — same input, same output', () => {
    const input = {
      subjects: [subject('a', 'A'), subject('b', 'B', 2)],
      prerequisites: [edge('b', 'a')],
      states: [state('a', 'passed')],
    }
    expect(computeSubjectViews(input)).toEqual(computeSubjectViews(input))
  })
})

describe('groupByYear', () => {
  it('groups ascending by year and orders by displayOrder then name', () => {
    const views = computeSubjectViews({
      subjects: [
        subject('c', 'Zeta', 2, { displayOrder: 1 }),
        subject('a', 'Beta', 1, { displayOrder: 2 }),
        subject('b', 'Alfa', 1, { displayOrder: 1 }),
      ],
      prerequisites: [],
      states: [],
    })

    const groups = groupByYear(views)
    expect(groups.map((g) => g.yearLevel)).toEqual([1, 2])
    expect(groups[0]?.subjects.map((s) => s.name)).toEqual(['Alfa', 'Beta'])
  })

  it('returns an empty array for an empty curriculum', () => {
    expect(groupByYear([])).toEqual([])
  })
})
