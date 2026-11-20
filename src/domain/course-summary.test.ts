import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import {
  calendarDaysUntil,
  correlativasFact,
  courseSummary,
  courseTimeline,
  relativeDayLabel,
} from './course-summary'
import { manualToCurriculumSubject } from './manual-subjects'
import { edge, state, subject } from './test-fixtures'
import type { AcademicItem } from './types'

const NOW = new Date(2026, 10, 19, 15, 0) // jue 19/11, 15:00 local

function item(id: string, due: Date | null, over: Partial<AcademicItem> = {}): AcademicItem {
  return {
    id,
    curriculumSubjectId: 'am2',
    kind: 'assignment',
    title: id,
    startsAt: null,
    dueAt: due ? due.toISOString() : null,
    status: 'open',
    notes: null,
    ...over,
  }
}

const views = (known = true) =>
  computeSubjectViews({
    subjects: [
      subject('am1', 'Análisis Matemático I'),
      subject('ag', 'Álgebra'),
      subject('am2', 'Análisis Matemático II'),
      subject('an', 'Análisis Numérico'),
    ],
    prerequisites: [
      edge('am2', 'am1', 'to_take'),
      edge('am2', 'ag', 'to_take'),
      edge('am2', 'am1', 'to_pass'),
      edge('an', 'am2', 'to_take'),
    ],
    states: [state('am1', 'passed'), state('ag', 'regularized')],
    prerequisitesKnown: known,
  })

describe('courseTimeline', () => {
  it('puts overdue first, then upcoming by date, undated, and finished apart', () => {
    const t = courseTimeline(
      [
        item('later', new Date(2026, 10, 28, 9)),
        item('done', new Date(2026, 10, 20), { status: 'done' }),
        item('nodate', null),
        item('today', new Date(2026, 10, 19, 10)), // earlier today: still today, not overdue
        item('late', new Date(2026, 10, 17)),
      ],
      NOW,
    )
    expect(t.overdue.map((i) => i.id)).toEqual(['late'])
    expect(t.upcoming.map((i) => i.id)).toEqual(['today', 'later'])
    expect(t.undated.map((i) => i.id)).toEqual(['nodate'])
    expect(t.finished.map((i) => i.id)).toEqual(['done'])
  })
})

describe('correlativasFact', () => {
  it('counts distinct subjects: one required for cursar and rendir is one', () => {
    const am2 = views().find((v) => v.id === 'am2')!
    // am1 passed (meets to_take and to_pass), ag only regularized (meets to_take).
    expect(correlativasFact(am2, true)).toEqual({ kind: 'counted', met: 2, total: 2 })
  })

  it('a subject is unmet while any of its requirements is unmet', () => {
    const an = views().find((v) => v.id === 'an')!
    expect(correlativasFact(an, true)).toEqual({ kind: 'counted', met: 0, total: 1 })
  })

  it('never says "none" for a plan whose correlativas were not published', () => {
    const am1 = views(false).find((v) => v.id === 'am1')!
    expect(correlativasFact(am1, false)).toEqual({ kind: 'unknown' })
    expect(
      correlativasFact(
        views().find((v) => v.id === 'am1')!,
        true,
      ),
    ).toEqual({ kind: 'none' })
  })

  it('claims nothing for a subject typed in by hand', () => {
    const [manual] = computeSubjectViews({
      subjects: [
        manualToCurriculumSubject(
          { id: 'm', name: 'Cálculo', yearLevel: 1, term: '1c', status: null, grade: null },
          0,
        ),
      ],
      prerequisites: [],
      states: [],
    })
    expect(correlativasFact(manual!, true)).toEqual({ kind: 'manual' })
  })
})

describe('courseSummary', () => {
  it('names the next open date and how far it is', () => {
    const am2 = views().find((v) => v.id === 'am2')!
    const summary = courseSummary({
      subject: am2,
      items: [
        item('Segundo parcial', new Date(2026, 10, 28, 9)),
        item('Guía', new Date(2026, 10, 20, 18)),
        item('Vieja', new Date(2026, 10, 10)),
      ],
      materialCount: 3,
      prerequisitesKnown: true,
      now: NOW,
    })
    expect(summary.upcomingCount).toBe(2)
    expect(summary.next?.id).toBe('Guía')
    expect(summary.daysUntilNext).toBe(1)
    expect(summary.overdueCount).toBe(1)
    expect(summary.unlocksCount).toBe(1)
    expect(summary.materialCount).toBe(3)
  })

  it('has no next date when nothing is ahead', () => {
    const am2 = views().find((v) => v.id === 'am2')!
    const summary = courseSummary({
      subject: am2,
      items: [],
      materialCount: 0,
      prerequisitesKnown: true,
      now: NOW,
    })
    expect(summary).toMatchObject({ upcomingCount: 0, next: null, daysUntilNext: null })
  })
})

describe('day labels', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(calendarDaysUntil(new Date(2026, 10, 20, 1), NOW)).toBe(1)
    expect(calendarDaysUntil(new Date(2026, 10, 19, 23), NOW)).toBe(0)
  })

  it('reads as Hoy / Mañana / En N días', () => {
    expect(relativeDayLabel(0)).toBe('Hoy')
    expect(relativeDayLabel(1)).toBe('Mañana')
    expect(relativeDayLabel(5)).toBe('En 5 días')
  })
})
