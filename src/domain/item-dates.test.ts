import { describe, expect, it } from 'vitest'

import { describeItemDate, sortByDate } from './item-dates'
import type { AcademicItem } from './types'

const item = (
  id: string,
  dueAt: string | null,
  startsAt: string | null = null,
): AcademicItem => ({
  id,
  curriculumSubjectId: null,
  kind: 'assignment',
  title: id,
  startsAt,
  dueAt,
  status: 'open',
  notes: null,
})

/** Local-time ISO, so the tests hold in any timezone the CI runs in. */
const local = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  new Date(y, mo - 1, d, h, mi).toISOString()

describe('describeItemDate', () => {
  it('shows weekday and day/month', () => {
    expect(describeItemDate(item('a', local(2026, 10, 23, 18, 30)))).toBe('vie 23/10')
  })

  it('says "Sin fecha" for an undated item', () => {
    expect(describeItemDate(item('a', null))).toBe('Sin fecha')
  })

  it('anchors on the due date, falling back to the start', () => {
    expect(describeItemDate(item('a', null, local(2026, 11, 2, 9, 0)))).toBe('lun 2/11')
  })
})

describe('sortByDate', () => {
  it('orders ascending, with undated rows last', () => {
    const sorted = sortByDate([
      item('none', null),
      item('late', local(2026, 12, 1, 10)),
      item('early', local(2026, 10, 5, 10)),
    ])
    expect(sorted.map((i) => i.id)).toEqual(['early', 'late', 'none'])
  })
})
