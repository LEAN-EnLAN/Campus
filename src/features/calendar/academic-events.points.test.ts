import { describe, expect, it } from 'vitest'

import type { AcademicItem } from '@/domain/types'

import { dateOnlyDueAt } from '@/features/items/due'

import { projectAcademicItems } from './academic-events'

const due = (dueAt: string): AcademicItem => ({
  id: 'i1',
  curriculumSubjectId: null,
  kind: 'final',
  title: 'Final',
  startsAt: null,
  dueAt,
  status: 'open',
  notes: null,
})

const local = (h: number, m: number, day = 10) => new Date(2026, 11, day, h, m, 0).toISOString()

describe('a deadline is one point on its date', () => {
  it('a date saved without a time is an all-day marker on that date', () => {
    const { events } = projectAcademicItems([due(dateOnlyDueAt(2026, 12, 10))])

    expect(events).toHaveLength(1)
    expect(events[0]!.allDay).toBe(true)
    expect(events[0]!.start.toString()).toBe('2026-12-10')
    expect(events[0]!.end.toString()).toBe('2026-12-10')
  })

  it.each([
    [22, 30],
    [23, 0],
    [23, 30],
    [23, 59],
  ])('a deadline typed at %i:%i never reaches the next day', (h, m) => {
    const { events } = projectAcademicItems([due(local(h, m))])

    const day = (value: { toString(): string }) => value.toString().slice(0, 10)
    expect(day(events[0]!.start)).toBe('2026-12-10')
    expect(day(events[0]!.end)).toBe('2026-12-10')
  })

  it('a typed 23:59 is a real time, not an all-day marker', () => {
    const { events } = projectAcademicItems([due(local(23, 59))])

    expect(events[0]!.allDay).toBe(false)
    expect(events[0]!.start.toString()).toContain('2026-12-10T23:59')
  })

  it('a deadline with a time keeps that time', () => {
    const { events } = projectAcademicItems([due(local(16, 0))])

    expect(events[0]!.allDay).toBe(false)
    expect(events[0]!.start.toString()).toContain('2026-12-10T16:00')
  })
})
