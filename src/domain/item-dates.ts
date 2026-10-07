import type { AcademicItem } from './types'

/**
 * How a dated item reads on a subject page.
 *
 * The data model has no "this item has a time" flag: a date typed without an
 * hour is stored as 23:59 local (end of day) by Quick Capture, and a bare date
 * elsewhere is local midnight. Both mean "no time was set", so neither is shown
 * as an hour the student never chose. The cost: a deadline deliberately set to
 * exactly 23:59 or 00:00 also reads as all-day.
 */

const WEEKDAY = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const

function anchorOf(item: AcademicItem): Date | null {
  const raw = item.dueAt ?? item.startsAt
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function hasRealTime(date: Date): boolean {
  const h = date.getHours()
  const m = date.getMinutes()
  if (h === 0 && m === 0) return false
  if (h === 23 && m === 59) return false
  return true
}

export interface ItemDateLabel {
  /** "vie 23/10", or "Sin fecha". */
  date: string
  /** "18:30" only when the student set one. */
  time: string | null
}

export function describeItemDate(item: AcademicItem): ItemDateLabel {
  const at = anchorOf(item)
  if (!at) return { date: 'Sin fecha', time: null }

  const date = `${WEEKDAY[at.getDay()]} ${at.getDate()}/${at.getMonth() + 1}`
  const time = hasRealTime(at)
    ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
    : null
  return { date, time }
}

/** Ascending by date; undated items last. Stable for equal dates. */
export function sortByDate<T extends AcademicItem>(items: readonly T[]): T[] {
  const key = (item: T) => anchorOf(item)?.getTime() ?? Number.POSITIVE_INFINITY
  return [...items].sort((a, b) => key(a) - key(b))
}
