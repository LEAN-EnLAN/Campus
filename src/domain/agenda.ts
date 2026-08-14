import type { AcademicItem } from './types'

/**
 * CAP-TODAY-001 — Today prioritises today over tomorrow without hiding what's next.
 *
 * Pure date bucketing. The caller passes `now` explicitly: the domain never reads
 * the clock, so tests are deterministic and the UI can render "today" for any
 * timezone the browser reports.
 */

export type AgendaBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'undated'

export interface AgendaEntry {
  item: AcademicItem
  bucket: AgendaBucket
  /** Whole days from today. Negative = past. Null when the item has no date. */
  dayOffset: number | null
}

export interface Agenda {
  overdue: AgendaEntry[]
  today: AgendaEntry[]
  tomorrow: AgendaEntry[]
  week: AgendaEntry[]
  later: AgendaEntry[]
  undated: AgendaEntry[]
}

const MS_PER_DAY = 86_400_000

/** Midnight local time for the given instant. */
function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Whole-day difference in LOCAL time.
 *
 * Computed from local midnights rather than raw millisecond division, so a DST
 * shift cannot turn "tomorrow" into "today".
 */
export function dayOffset(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime()
  const b = startOfLocalDay(to).getTime()
  return Math.round((b - a) / MS_PER_DAY)
}

function bucketFor(offset: number): AgendaBucket {
  if (offset < 0) return 'overdue'
  if (offset === 0) return 'today'
  if (offset === 1) return 'tomorrow'
  if (offset <= 7) return 'week'
  return 'later'
}

/** The instant an item is anchored to: its due date, else its start. */
function anchorOf(item: AcademicItem): string | null {
  return item.dueAt ?? item.startsAt
}

/**
 * Bucket open academic items relative to `now`.
 *
 * Done and cancelled items never appear — Today is about what is left to do.
 * Within a bucket, dated items sort chronologically; undated ones sort by title.
 */
export function buildAgenda(items: readonly AcademicItem[], now: Date): Agenda {
  const agenda: Agenda = {
    overdue: [],
    today: [],
    tomorrow: [],
    week: [],
    later: [],
    undated: [],
  }

  for (const item of items) {
    if (item.status !== 'open') continue

    const anchor = anchorOf(item)
    if (anchor === null) {
      agenda.undated.push({ item, bucket: 'undated', dayOffset: null })
      continue
    }

    const at = new Date(anchor)
    if (Number.isNaN(at.getTime())) {
      // A malformed timestamp must not silently vanish from the student's list.
      agenda.undated.push({ item, bucket: 'undated', dayOffset: null })
      continue
    }

    const offset = dayOffset(now, at)
    const bucket = bucketFor(offset)
    agenda[bucket].push({ item, bucket, dayOffset: offset })
  }

  const byTime = (a: AgendaEntry, b: AgendaEntry): number => {
    const at = anchorOf(a.item)
    const bt = anchorOf(b.item)
    if (at && bt) {
      const diff = new Date(at).getTime() - new Date(bt).getTime()
      if (diff !== 0) return diff
    }
    return a.item.title.localeCompare(b.item.title, 'es')
  }

  agenda.overdue.sort(byTime)
  agenda.today.sort(byTime)
  agenda.tomorrow.sort(byTime)
  agenda.week.sort(byTime)
  agenda.later.sort(byTime)
  agenda.undated.sort((a, b) => a.item.title.localeCompare(b.item.title, 'es'))

  return agenda
}

/** What Today counts as "things that matter today": overdue + today. */
export function todayCount(agenda: Agenda): number {
  return agenda.overdue.length + agenda.today.length
}

/** Items in a calendar window, inclusive of both ends, chronologically. */
export function itemsInRange(
  items: readonly AcademicItem[],
  from: Date,
  to: Date,
): AcademicItem[] {
  const start = startOfLocalDay(from).getTime()
  const end = startOfLocalDay(to).getTime() + MS_PER_DAY - 1

  return items
    .filter((item) => {
      if (item.status === 'cancelled') return false
      const anchor = anchorOf(item)
      if (!anchor) return false
      const t = new Date(anchor).getTime()
      return !Number.isNaN(t) && t >= start && t <= end
    })
    .sort((a, b) => {
      const at = new Date(anchorOf(a) as string).getTime()
      const bt = new Date(anchorOf(b) as string).getTime()
      return at - bt || a.title.localeCompare(b.title, 'es')
    })
}

/** Monday-based start of the week containing `date` (Argentine convention). */
export function startOfWeek(date: Date): Date {
  const d = startOfLocalDay(date)
  const dow = d.getDay() // 0 = Sunday
  const delta = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + delta)
  return d
}

/** The seven local days of the week containing `date`. */
export function weekDays(date: Date): Date[] {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}
