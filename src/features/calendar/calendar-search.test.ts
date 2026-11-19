import { describe, expect, it } from 'vitest'

import { calendarDayParam, parseCalendarDay, validateCalendarSearch } from './calendar-search'

describe('calendar ?date= search param', () => {
  it('keeps a real calendar day', () => {
    expect(validateCalendarSearch({ date: '2026-11-12' })).toEqual({ date: '2026-11-12' })
    const day = parseCalendarDay('2026-11-12')!
    expect([day.getFullYear(), day.getMonth(), day.getDate(), day.getHours()]).toEqual([
      2026, 10, 12, 0,
    ])
  })

  it.each([
    ['a day that does not exist', '2026-02-30'],
    ['a month that does not exist', '2026-13-01'],
    ['a timestamp', '2026-11-12T10:00:00Z'],
    ['a word', 'viernes'],
    ['an Argentine-format date', '12/11/2026'],
    ['a number', 20261112],
    ['nothing', undefined],
  ])('drops %s', (_label, value) => {
    expect(validateCalendarSearch({ date: value })).toEqual({})
  })

  it('spells a local instant as its local day', () => {
    expect(calendarDayParam(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})
