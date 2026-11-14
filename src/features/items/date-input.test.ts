import { describe, expect, it } from 'vitest'

import { combineDue, dueToInputs, parseDateInput, parseTimeInput } from './date-input'
import { dateOnlyDueAt, hasUserTime } from './due'

describe('parseDateInput (dd/mm/aaaa, whatever the browser locale)', () => {
  it('reads day first', () => {
    expect(parseDateInput('23/10/2026')).toEqual({ year: 2026, month: 10, day: 23 })
    expect(parseDateInput('03/04/2026')).toEqual({ year: 2026, month: 4, day: 3 })
  })

  it('accepts one-digit parts and the usual separators', () => {
    expect(parseDateInput('3/4/2026')).toEqual({ year: 2026, month: 4, day: 3 })
    expect(parseDateInput('3-4-2026')).toEqual({ year: 2026, month: 4, day: 3 })
    expect(parseDateInput(' 3.4.2026 ')).toEqual({ year: 2026, month: 4, day: 3 })
  })

  it('rejects dates that do not exist', () => {
    expect(parseDateInput('31/02/2026')).toBeNull()
    expect(parseDateInput('10/13/2026')).toBeNull()
    expect(parseDateInput('00/10/2026')).toBeNull()
  })

  it('rejects anything that is not three numbers', () => {
    expect(parseDateInput('')).toBeNull()
    expect(parseDateInput('mañana')).toBeNull()
    expect(parseDateInput('23/10')).toBeNull()
    expect(parseDateInput('23/10/26')).toBeNull()
  })
})

describe('parseTimeInput', () => {
  it('reads hh:mm in 24 hours', () => {
    expect(parseTimeInput('18:30')).toEqual({ hours: 18, minutes: 30 })
    expect(parseTimeInput('9:05')).toEqual({ hours: 9, minutes: 5 })
    expect(parseTimeInput('9.05')).toEqual({ hours: 9, minutes: 5 })
  })

  it('rejects what is not a time', () => {
    expect(parseTimeInput('24:00')).toBeNull()
    expect(parseTimeInput('18:60')).toBeNull()
    expect(parseTimeInput('seis')).toBeNull()
  })
})

describe('combineDue', () => {
  it('is null without a date', () => {
    expect(combineDue(null, null)).toBeNull()
    expect(combineDue(null, { hours: 9, minutes: 0 })).toBeNull()
  })

  it('records "no time" explicitly when only a date was given', () => {
    const iso = combineDue({ year: 2026, month: 10, day: 23 }, null)!

    expect(hasUserTime(iso)).toBe(false)
    expect(new Date(iso).getDate()).toBe(23)
  })

  it('keeps a typed 23:59 as a time', () => {
    const iso = combineDue({ year: 2026, month: 10, day: 23 }, { hours: 23, minutes: 59 })!

    expect(hasUserTime(iso)).toBe(true)
    const date = new Date(iso)
    expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([23, 59, 0])
  })
})

describe('dueToInputs (what the edit form shows)', () => {
  it('shows a typed time', () => {
    expect(dueToInputs(new Date(2026, 9, 3, 18, 30).toISOString())).toEqual({
      date: '03/10/2026',
      time: '18:30',
    })
  })

  it('shows no time for a date-only item, never the 23:59 that stands in for it', () => {
    expect(dueToInputs(dateOnlyDueAt(2026, 10, 23))).toEqual({ date: '23/10/2026', time: '' })
  })

  it('keeps a real 23:59 deadline as a time', () => {
    expect(dueToInputs(new Date(2026, 9, 23, 23, 59).toISOString()).time).toBe('23:59')
  })

  it('is blank for no date or a broken one', () => {
    expect(dueToInputs(null)).toEqual({ date: '', time: '' })
    expect(dueToInputs('not a date')).toEqual({ date: '', time: '' })
  })

  it('round-trips through the parser: an untouched edit stores the same instant', () => {
    for (const iso of [
      dateOnlyDueAt(2026, 10, 23),
      new Date(2026, 9, 23, 9, 5).toISOString(),
    ]) {
      const { date, time } = dueToInputs(iso)
      expect(combineDue(parseDateInput(date), time ? parseTimeInput(time) : null)).toBe(iso)
    }
  })
})
