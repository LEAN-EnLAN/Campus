import type { AcademicItem } from '@/domain/types'
import { anchorOf, dueTimeLabel } from '@/features/items/due'

export interface AgendaDay {
  /** Local midnight of the day. */
  date: Date
  items: AcademicItem[]
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Open and done items from `now`'s day onward, grouped by day, soonest first. */
export function buildAgendaDays(items: readonly AcademicItem[], now: Date): AgendaDay[] {
  const from = startOfDay(now).getTime()
  const entries: { item: AcademicItem; at: Date; day: number }[] = []

  for (const item of items) {
    if (item.status === 'cancelled') continue
    const anchor = anchorOf(item)
    if (!anchor) continue
    const at = new Date(anchor)
    if (Number.isNaN(at.getTime())) continue
    const day = startOfDay(at).getTime()
    if (day < from) continue
    entries.push({ item, at, day })
  }

  // Within a day: timed items by clock, then the ones with no time at all.
  const rank = (e: { item: AcademicItem; at: Date }) =>
    dueTimeLabel(e.item) === null ? Number.POSITIVE_INFINITY : e.at.getTime()
  entries.sort(
    (a, b) =>
      a.day - b.day || rank(a) - rank(b) || a.item.title.localeCompare(b.item.title, 'es'),
  )

  const days: AgendaDay[] = []
  for (const entry of entries) {
    const last = days[days.length - 1]
    if (last && last.date.getTime() === entry.day) last.items.push(entry.item)
    else days.push({ date: new Date(entry.day), items: [entry.item] })
  }
  return days
}
