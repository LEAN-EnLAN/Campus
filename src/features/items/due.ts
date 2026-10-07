import type { AcademicItem } from '@/domain/types'

/**
 * When something is due, as the student meant it.
 *
 * An item stores ONE instant, and "entrega el viernes" has no hour. "No time"
 * is recorded IN that instant, with no schema change in either backend: a
 * date-only item is saved as 23:59:59.999 local on its day. Milliseconds are the
 * marker because nothing a person types has them (a time field gives whole
 * minutes), so it cannot collide with a real deadline — "hasta las 23:59" is
 * 23:59:00.000 and stays a time. Items saved before this carried 23:59:00 and
 * are therefore times; nothing here guesses otherwise.
 *
 * Every screen asks THIS module whether an item has a time. None of them
 * compares clock digits itself.
 */

/** The millisecond value that means "the student gave a date and no time". */
const DATE_ONLY_MS = 999

/** The instant to store for a date with no time. `month` is 1-12. */
export function dateOnlyDueAt(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 23, 59, 59, DATE_ONLY_MS).toISOString()
}

const TIME_FORMAT = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const pad = (n: number) => String(n).padStart(2, '0')

function parse(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Does this instant carry no time of day?
 *
 * The explicit marker, plus exact local midnight: a vault edited by hand writes
 * `2026-10-23T00:00` for "that day", and a 00:00 deadline nobody types.
 */
export function isDateOnly(date: Date): boolean {
  if (date.getMilliseconds() === DATE_ONLY_MS) return true
  return (
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  )
}

/** Did the student type a time for this instant? */
export function hasUserTime(iso: string | null): boolean {
  const date = parse(iso)
  return date !== null && !isDateOnly(date)
}

/** The instant an item is anchored to: its due date, else its start. */
export function anchorOf(item: Pick<AcademicItem, 'dueAt' | 'startsAt'>): string | null {
  return item.dueAt ?? item.startsAt
}

/** `HH:MM`, or null when the item has no date or the student set no time. */
export function dueTimeLabel(item: Pick<AcademicItem, 'dueAt' | 'startsAt'>): string | null {
  const anchor = anchorOf(item)
  const date = parse(anchor)
  if (!date || isDateOnly(date)) return null
  return TIME_FORMAT.format(date)
}

/** `dd/mm`, or "Sin fecha". Sorting by date is the caller's job. */
export function dueDateLabel(item: Pick<AcademicItem, 'dueAt' | 'startsAt'>): string {
  const date = parse(anchorOf(item))
  return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}` : 'Sin fecha'
}
