import { describe, expect, it } from 'vitest'

import { combineDue, parseDateInput, parseTimeInput } from './date-input'
import { hasUserTime } from './due'

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
