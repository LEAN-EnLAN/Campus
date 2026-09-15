import { describe, expect, it } from 'vitest'

import type { AcademicItem } from '@/domain/types'

import { projectAcademicItems, UNASSIGNED_CALENDAR } from './academic-events'

const item = (over: Partial<AcademicItem> = {}): AcademicItem => ({
  id: 'i1',
  curriculumSubjectId: 'subj-analisis',
  kind: 'midterm',
  title: 'Parcial 1',
  startsAt: null,
  dueAt: '2026-09-15T16:10:00.000Z',
  status: 'open',
  notes: null,
  ...over,
})

/** The grid renders wall-clock time, so the assertions are written in it. */
const local = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

describe('projectAcademicItems', () => {
  it('anchors an item to its due date when it has both dates', () => {
    const { events } = projectAcademicItems([
      item({ startsAt: '2026-09-15T12:00:00.000Z', dueAt: '2026-09-15T16:10:00.000Z' }),
    ])

    // Both dates present means a real span: the class runs from start to due.
    expect(events).toHaveLength(1)
    expect(events[0]!.start.toString()).toContain(local('2026-09-15T12:00:00.000Z'))
    expect(events[0]!.end.toString()).toContain(local('2026-09-15T16:10:00.000Z'))
  })

  it('gives a deadline with only a due time a bounded block, not a zero-width event', () => {
    const { events } = projectAcademicItems([item({ startsAt: null })])

    // A zero-length event is invisible in a time grid. The block is an honest
    // rendering decision, and it starts AT the deadline.
    expect(events[0]!.start.toString()).toContain(local('2026-09-15T16:10:00.000Z'))
    expect(events[0]!.start.toString()).not.toBe(events[0]!.end.toString())
  })

  it('treats a midnight anchor as all-day, because that is a date without a time', () => {
    const midnight = new Date(2026, 8, 15, 0, 0, 0)
    const { events } = projectAcademicItems([item({ dueAt: midnight.toISOString() })])

    expect(events[0]!.allDay).toBe(true)
    // An all-day event carries a PlainDate: no hour component at all.
    expect(events[0]!.start.toString()).toBe('2026-09-15')
  })

  it('keeps DONE items: a calendar records what happened, unlike Today', () => {
    const { events } = projectAcademicItems([item({ status: 'done' })])

    expect(events).toHaveLength(1)
    expect(events[0]!.meta?.done).toBe(true)
  })

  it('drops CANCELLED items entirely — not into events, not into undated', () => {
    const { events, undated } = projectAcademicItems([item({ status: 'cancelled' })])

    expect(events).toEqual([])
    expect(undated).toEqual([])
  })

  it('names undated items instead of silently dropping them', () => {
    const orphan = item({ id: 'i2', startsAt: null, dueAt: null })
    const { events, undated } = projectAcademicItems([orphan])

    // The screen must be able to say "3 sin fecha". An item that exists and is
    // shown nowhere is the failure mode this guards.
    expect(events).toEqual([])
    expect(undated.map((i) => i.id)).toEqual(['i2'])
  })

  it('treats an unparseable date as undated rather than as an Invalid Date event', () => {
    const { events, undated } = projectAcademicItems([item({ id: 'i3', dueAt: 'no-es-fecha' })])

    expect(events).toEqual([])
    expect(undated.map((i) => i.id)).toEqual(['i3'])
  })

  it('groups events by SUBJECT, so colour says which subject an event belongs to', () => {
    // Reversed from the original design on purpose. It used to group by KIND,
    // because one accent cannot carry forty subjects — but the palette now
    // GENERATES a harmonic hue per subject, so colour can mean identity and
    // shade can mean importance. See event-paint.ts.
    const { events } = projectAcademicItems([
      item({ id: 'a', kind: 'midterm', curriculumSubjectId: 'subj-algebra' }),
      item({ id: 'b', kind: 'class', curriculumSubjectId: null }),
    ])

    expect(events.find((e) => e.id === 'a')!.calendarId).toBe('subj-algebra')
    expect(events.find((e) => e.id === 'b')!.calendarId).toBe(UNASSIGNED_CALENDAR)
  })

  it('refuses to build a backwards span when startsAt is after dueAt', () => {
    // Real vault data is hand-edited. An inverted range would render as a
    // negative-height block or throw inside the layout engine, so the due date
    // wins and the item falls back to a plain deadline block.
    const { events } = projectAcademicItems([
      item({ startsAt: '2026-09-15T18:00:00.000Z', dueAt: '2026-09-15T16:10:00.000Z' }),
    ])

    expect(events).toHaveLength(1)
    expect(events[0]!.start.toString()).toContain(local('2026-09-15T16:10:00.000Z'))
    expect(events[0]!.start.toString() < events[0]!.end.toString()).toBe(true)
  })

  it('carries the original item in meta so slots can render Campus components', () => {
    const source = item()
    const { events } = projectAcademicItems([source])

    expect(events[0]!.meta?.item).toBe(source)
  })

  it('sorts events chronologically so equal-time ties stay deterministic', () => {
    const { events } = projectAcademicItems([
      item({ id: 'late', dueAt: '2026-09-16T10:00:00.000Z', title: 'B' }),
      item({ id: 'early', dueAt: '2026-09-15T10:00:00.000Z', title: 'A' }),
      item({ id: 'tie', dueAt: '2026-09-16T10:00:00.000Z', title: 'A' }),
    ])

    expect(events.map((e) => e.id)).toEqual(['early', 'tie', 'late'])
  })
})
