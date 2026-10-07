import { dateToPlainDate, dateToPlainDateTime, type Event } from '@dayflow/react'

import type { AcademicItem } from '@/domain/types'
import { isDateOnly } from '@/features/items/due'

/**
 * Academic items projected onto a calendar grid.
 *
 * This is the whole translation layer between Campus's domain and DayFlow, and
 * it is pure on purpose: a grid is unforgiving about dates, and every decision
 * below is one a test can pin down without a browser.
 *
 * The rules mirror `itemsInRange` — cancelled items are gone, done items stay —
 * with one addition Today does not need: an item with no date at all cannot be
 * placed on a grid, so it is RETURNED rather than dropped. A calendar that
 * silently swallows three deadlines is worse than one that admits it.
 */

/** Where items with no subject go. One group, so they still get a colour. */
export const UNASSIGNED_CALENDAR = 'sin-materia'

/**
 * How long a deadline occupies the grid.
 *
 * A due time is an instant, and an instant has no height in a time grid — it
 * would render as an invisible hairline. One hour is the conventional reading
 * and it starts AT the deadline, never before: nothing here invents the idea
 * that the student began working an hour earlier.
 */
const DEADLINE_BLOCK_MINUTES = 60

export interface CalendarProjection {
  events: Event[]
  /** Items that carry no usable date. Shown as a named list, never hidden. */
  undated: AcademicItem[]
}

/** A Date, or null when the value is absent or not a date at all. */
function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** The last instant of `date`'s local day. A deadline block never goes past it. */
function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
}

/**
 * A deadline's box on a time grid, clamped to its own day.
 *
 * A time grid needs height, so a typed deadline gets an hour — but a block that
 * starts at 23:30 must not end on the NEXT day: that is how one exam turned into
 * two rows, "Starts 23:59" on the 10th and "Ends 00:59" on the 11th.
 */
function deadlineEnd(start: Date): Date {
  const hour = new Date(start.getTime() + DEADLINE_BLOCK_MINUTES * 60_000)
  const limit = endOfLocalDay(start)
  return hour.getTime() > limit.getTime() ? limit : hour
}

export function projectAcademicItems(items: readonly AcademicItem[]): CalendarProjection {
  const events: { event: Event; sortKey: number; title: string }[] = []
  const undated: AcademicItem[] = []

  for (const item of items) {
    // Cancelled is not "done differently" — it did not happen and will not.
    if (item.status === 'cancelled') continue

    const due = parseDate(item.dueAt)
    const starts = parseDate(item.startsAt)
    const anchor = due ?? starts
    if (!anchor) {
      undated.push(item)
      continue
    }

    // A span only exists when both ends do AND they point forwards. Vault data
    // is hand-edited, and an inverted range breaks the layout engine.
    const span = due && starts && starts.getTime() < due.getTime() ? { starts, due } : null

    // No span and no typed time: a date, not a moment. Midnight and the
    // end-of-day the capture form writes both mean "this day" and nothing finer.
    const allDay = !span && isDateOnly(anchor)
    const start = span ? span.starts : anchor
    const end = span ? span.due : deadlineEnd(anchor)

    events.push({
      sortKey: start.getTime(),
      title: item.title,
      event: {
        id: item.id,
        title: item.title,
        // An all-day item carries a PlainDate: DayFlow reads the absence of a
        // time component as the all-day row, rather than a 00:00 block.
        start: allDay ? dateToPlainDate(start) : dateToPlainDateTime(start),
        end: allDay ? dateToPlainDate(start) : dateToPlainDateTime(end),
        allDay,
        // Grouped by SUBJECT: colour says which subject, shade says how much it
        // matters (see event-paint.ts). Items with no subject share one group.
        calendarId: item.curriculumSubjectId ?? UNASSIGNED_CALENDAR,
        // The slots render Campus components, so they need the domain object —
        // not a flattened copy that would drift from it.
        meta: { item, done: item.status === 'done' },
      },
    })
  }

  events.sort((a, b) => a.sortKey - b.sortKey || a.title.localeCompare(b.title, 'es'))

  return { events: events.map((e) => e.event), undated }
}
