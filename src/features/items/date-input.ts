import { dateOnlyDueAt, hasUserTime } from './due'

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

const DATE = /^(\d{1,2})[/.,-](\d{1,2})[/.,-](\d{2}|\d{4})$/
/** "25122026" / "251226": no separators at all. */
const COMPACT_DATE = /^(\d{2})(\d{2})(\d{2}|\d{4})$/
const TIME = /^(\d{1,2})[:.](\d{2})$/

/** A two-digit year is this century: "26" is 2026. */
const fullYear = (digits: string) =>
  digits.length === 2 ? 2000 + Number(digits) : Number(digits)

/** The three numbers as typed, with no check that the day exists. */
function readDateLoosely(text: string): DateParts | null {
  const trimmed = text.trim()
  const match = DATE.exec(trimmed) ?? COMPACT_DATE.exec(trimmed)
  if (!match) return null
  return { day: Number(match[1]), month: Number(match[2]), year: fullYear(match[3] ?? '') }
}

export function parseDateInput(text: string): DateParts | null {
  const loose = readDateLoosely(text)
  if (!loose) return null
  const { day, month, year } = loose
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

const pad = (n: number) => String(n).padStart(2, '0')

/** `dd/mm/aaaa`, the one shape the date field shows. */
export function formatDateInput(date: DateParts): string {
  return `${pad(date.day)}/${pad(date.month)}/${date.year}`
}

/**
 * Leading "d/" or "d:" groups get their zero ("3/" -> "03"), so a student who
 * types the separator by hand ends up with the same text as one who does not.
 */
function padSeparatedGroups(raw: string, groups: number, keepAbove = 9): string {
  let out = ''
  let rest = raw
  for (let i = 0; i < groups; i++) {
    const match = /^\s*(\d{1,2})\D+/.exec(rest)
    if (!match) break
    // A lone digit above `keepAbove` is already a whole group (an hour of 3-9),
    // and it is also what the mask itself writes: "9:3" must not become "09:3".
    const group = match[1] ?? ''
    out += group.length === 1 && Number(group) > keepAbove ? group : group.padStart(2, '0')
    rest = rest.slice(match[0].length)
  }
  return out + rest
}

/**
 * The text of the date field for whatever was typed: digits only (max 8), "/"
 * inserted after dd and mm. A separator is only ever shown BEFORE a digit, so
 * deleting the last digit never leaves a "/" the mask would put back.
 * "2512" -> "25/12", "25122026" -> "25/12/2026".
 */
export function maskDateDigits(raw: string): string {
  const digits = padSeparatedGroups(raw, 2).replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/')
}

/**
 * The text of the time field: max 4 digits, ":" after the hour. An hour that
 * starts with 3-9 can only be one digit, so "930" -> "9:30" and "93" -> "9:3";
 * "0930" -> "09:30", "2359" -> "23:59". Nothing is validated here: "2460"
 * shows as "24:60" and the parser says no.
 */
export function maskTimeDigits(raw: string): string {
  const digits = padSeparatedGroups(raw, 1, 2).replace(/\D/g, '').slice(0, 4)
  if (digits === '') return ''
  const hourLength = Number(digits[0]) > 2 ? 1 : 2
  const hours = digits.slice(0, hourLength)
  const minutes = digits.slice(hourLength, hourLength + 2)
  return minutes ? `${hours}:${minutes}` : hours
}

/**
 * A pasted date as `dd/mm/aaaa`: "25/12/2026", "25122026", "25-12-26" and
 * "25.12.26" all become "25/12/2026". Not a date at all -> masked best effort.
 */
export function normalizePastedDate(text: string): string {
  const loose = readDateLoosely(text)
  return loose ? formatDateInput(loose) : maskDateDigits(text)
}

/**
 * The text the form shows for a stored instant — the inverse of `combineDue`.
 *
 * `dd/mm/aaaa` always; `hh:mm` only when the student typed a time. A date-only
 * item opens with the time EMPTY, never with the 23:59 that stands in for it.
 */
export function dueToInputs(iso: string | null): { date: string; time: string } {
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return { date: '', time: '' }
  return {
    date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    time: hasUserTime(iso) ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : '',
  }
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
