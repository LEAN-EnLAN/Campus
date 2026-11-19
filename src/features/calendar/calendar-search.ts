/**
 * The calendar's URL contract: `/calendar?date=YYYY-MM-DD` opens the grid on
 * that day. Search deep-links a result there, so the student lands on the date
 * of the thing they looked for instead of on "this month".
 *
 * A date that is not a real calendar day (2026-02-30, "viernes", a timestamp)
 * is dropped, not guessed: the calendar then opens where it always does.
 */

export interface CalendarSearch {
  date?: string
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** The day as a local Date at midnight, or null when the string is not a real day. */
export function parseCalendarDay(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const match = ISO_DAY.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  // Date rolls 2026-02-30 over to March; a round trip catches it.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null
  return date
}

export function validateCalendarSearch(search: Record<string, unknown>): CalendarSearch {
  return parseCalendarDay(search.date) ? { date: search.date as string } : {}
}

/** The local calendar day of an instant, as the `date` search param spells it. */
export function calendarDayParam(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}
