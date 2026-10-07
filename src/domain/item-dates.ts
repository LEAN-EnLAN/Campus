import type { AcademicItem } from './types'

/**
 * How a dated item reads on a subject page: its DATE.
 *
 * Whether the item also has a time is not decided here. A date-only item is
 * stored with a marker instant, and `features/items/due.ts` is the one module
 * that knows it (`dueTimeLabel`); a second heuristic here used to hide any
 * 23:59, including a deadline the student really set to 23:59.
 */

const WEEKDAY = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const

function anchorOf(item: AcademicItem): Date | null {
  const raw = item.dueAt ?? item.startsAt
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "vie 23/10", or "Sin fecha". */
export function describeItemDate(item: AcademicItem): string {
  const at = anchorOf(item)
  if (!at) return 'Sin fecha'
  return `${WEEKDAY[at.getDay()]} ${at.getDate()}/${at.getMonth() + 1}`
}

/** Ascending by date; undated items last. Stable for equal dates. */
export function sortByDate<T extends AcademicItem>(items: readonly T[]): T[] {
  const key = (item: T) => anchorOf(item)?.getTime() ?? Number.POSITIVE_INFINITY
  return [...items].sort((a, b) => key(a) - key(b))
}
