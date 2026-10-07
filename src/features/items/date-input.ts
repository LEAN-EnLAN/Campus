import { dateOnlyDueAt } from './due'

/**
 * Dates and times as a student types them.
 *
 * A native `<input type="date">` shows mm/dd/yyyy to anyone whose BROWSER is set
 * to English, whatever language the app is in, and a student typing "10/30"
 * has no way to know which side is the month. So the app owns the format:
 * a plain text field, day first, read here.
 */

export interface DateParts {
  year: number
  month: number
  day: number
}

export interface TimeParts {
  hours: number
  minutes: number
}

const DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/
const TIME = /^(\d{1,2})[:.](\d{2})$/

export function parseDateInput(text: string): DateParts | null {
  const match = DATE.exec(text.trim())
  if (!match) return null
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  // Round-trip through Date: 31/02 must not silently become 3 de marzo.
  const probe = new Date(year, month - 1, day)
  const real =
    probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day
  return real ? { year, month, day } : null
}

export function parseTimeInput(text: string): TimeParts | null {
  const match = TIME.exec(text.trim())
  if (!match) return null
  const [hours, minutes] = [Number(match[1]), Number(match[2])]
  return hours <= 23 && minutes <= 59 ? { hours, minutes } : null
}

/**
 * The instant to store, or null when there is no date.
 *
 * With a date and no time the item is recorded as DATE-ONLY (see `due.ts`): it
 * is not due at 23:59, it is due that day.
 */
export function combineDue(date: DateParts | null, time: TimeParts | null): string | null {
  if (!date) return null
  if (!time) return dateOnlyDueAt(date.year, date.month, date.day)
  return new Date(
    date.year,
    date.month - 1,
    date.day,
    time.hours,
    time.minutes,
    0,
  ).toISOString()
}
