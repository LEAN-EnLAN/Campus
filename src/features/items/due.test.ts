import { describe, expect, it } from 'vitest'

import type { AcademicItem } from '@/domain/types'

import { dateOnlyDueAt, dueDateLabel, dueTimeLabel, hasUserTime } from './due'

const item = (dueAt: string | null, startsAt: string | null = null): AcademicItem => ({
  id: 'i1',
  curriculumSubjectId: null,
  kind: 'assignment',
  title: 'TP',
  startsAt,
  dueAt,
  status: 'open',
  notes: null,
})

/** Local wall-clock, which is what a student typed. */
const at = (h: number, m: number, day = 15) => new Date(2026, 8, day, h, m, 0).toISOString()

describe('a time the student did not set', () => {
  it('is recorded by dateOnlyDueAt, and read back as no time', () => {
    const iso = dateOnlyDueAt(2026, 9, 15)

    expect(hasUserTime(iso)).toBe(false)
    expect(dueTimeLabel(item(iso))).toBeNull()
  })

  it('stays on the day the student picked', () => {
    const date = new Date(dateOnlyDueAt(2026, 9, 15))

    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 9, 15])
  })

  it('a real 23:59 deadline is a time: "entrega hasta las 23:59" is common', () => {
    expect(hasUserTime(at(23, 59))).toBe(true)
    expect(dueTimeLabel(item(at(23, 59)))).toBe('23:59')
  })

  it('is not a time at local midnight either', () => {
    expect(hasUserTime(at(0, 0))).toBe(false)
    expect(dueTimeLabel(item(at(0, 0)))).toBeNull()
  })

  it('is a time when the student typed one', () => {
    expect(hasUserTime(at(18, 30))).toBe(true)
    expect(dueTimeLabel(item(at(18, 30)))).toBe('18:30')
  })

  it('falls back to the start when there is no due date', () => {
    expect(dueTimeLabel(item(null, at(10, 0)))).toBe('10:00')
  })

  it('has no time when there is no date at all, or the date is garbage', () => {
    expect(dueTimeLabel(item(null))).toBeNull()
    expect(dueTimeLabel(item('no-es-fecha'))).toBeNull()
  })
})

describe('dueDateLabel', () => {
  it('writes the day the way Argentina does', () => {
    expect(dueDateLabel(item(dateOnlyDueAt(2026, 9, 23)))).toBe('23/09')
  })

  it('says "Sin fecha" for an undated item', () => {
    expect(dueDateLabel(item(null))).toBe('Sin fecha')
  })
})
