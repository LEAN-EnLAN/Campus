import { requirementGroups } from './requirements'
import type { AcademicItem, SubjectView } from './types'

/**
 * The facts a materia page leads with, and the order its dates are read in.
 *
 * Pure: the page passes `now`, so "próxima" and "atrasada" are decided here and
 * a test can pin the clock. Nothing re-derives availability; correlativas are
 * read from `SubjectView.requirements`, which the availability pass produced.
 */

const DAY_MS = 86_400_000

function anchorOf(item: AcademicItem): Date | null {
  const raw = item.dueAt ?? item.startsAt
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Whole calendar days from `now` to `date` in local time: 0 today, 1 tomorrow. */
export function calendarDaysUntil(date: Date, now: Date): number {
  return Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS)
}

export interface CourseTimeline {
  /** Open, dated before today. They still need doing, so they go first. */
  overdue: AcademicItem[]
  /** Open, dated today or later, soonest first. */
  upcoming: AcademicItem[]
  /** Open, with no date at all. */
  undated: AcademicItem[]
  /** Done or cancelled, whatever their date. */
  finished: AcademicItem[]
}

/** Split a subject's items by what the student still has to do. Each list keeps date order. */
export function courseTimeline(items: readonly AcademicItem[], now: Date): CourseTimeline {
  const today = startOfDay(now)
  const timeline: CourseTimeline = { overdue: [], upcoming: [], undated: [], finished: [] }
  const byDate = [...items].sort(
    (a, b) =>
      (anchorOf(a)?.getTime() ?? Number.POSITIVE_INFINITY) -
      (anchorOf(b)?.getTime() ?? Number.POSITIVE_INFINITY),
  )
  for (const item of byDate) {
    if (item.status !== 'open') {
      timeline.finished.push(item)
      continue
    }
    const at = anchorOf(item)
    if (!at) timeline.undated.push(item)
    else if (at.getTime() < today) timeline.overdue.push(item)
    else timeline.upcoming.push(item)
  }
  return timeline
}

/**
 * What can honestly be said about correlativas.
 *
 * `unknown` and `manual` are not zero: the plan never published them, or the
 * student typed the subject in. Showing "0" there would assert a fact we lack.
 */
export type CorrelativasFact =
  | { kind: 'manual' }
  | { kind: 'unknown' }
  | { kind: 'none' }
  | { kind: 'counted'; met: number; total: number }

/**
 * Correlativas as distinct SUBJECTS. One required for cursar and for rendir is
 * one subject, met only when every requirement it carries is met.
 */
export function correlativasFact(
  subject: SubjectView,
  prerequisitesKnown: boolean,
): CorrelativasFact {
  if (subject.manual) return { kind: 'manual' }
  const { cursar, rendir } = requirementGroups(subject)
  const metById = new Map<string, boolean>()
  for (const item of [...cursar, ...rendir]) {
    metById.set(
      item.curriculumSubjectId,
      (metById.get(item.curriculumSubjectId) ?? true) && item.met,
    )
  }
  if (metById.size === 0) return prerequisitesKnown ? { kind: 'none' } : { kind: 'unknown' }
  let met = 0
  for (const value of metById.values()) if (value) met++
  return { kind: 'counted', met, total: metById.size }
}

export interface CourseSummary {
  /** Open items dated today or later. */
  upcomingCount: number
  /** The soonest of them, if any. */
  next: AcademicItem | null
  /** Calendar days to `next`: 0 today, 1 tomorrow. Null without `next`. */
  daysUntilNext: number | null
  overdueCount: number
  correlativas: CorrelativasFact
  /** Subjects this one unlocks. */
  unlocksCount: number
  materialCount: number
}

export function courseSummary({
  subject,
  items,
  materialCount,
  prerequisitesKnown,
  now,
}: {
  subject: SubjectView
  /** This subject's items only. */
  items: readonly AcademicItem[]
  materialCount: number
  prerequisitesKnown: boolean
  now: Date
}): CourseSummary {
  const timeline = courseTimeline(items, now)
  const next = timeline.upcoming[0] ?? null
  const nextAt = next ? anchorOf(next) : null
  return {
    upcomingCount: timeline.upcoming.length,
    next,
    daysUntilNext: nextAt ? calendarDaysUntil(nextAt, now) : null,
    overdueCount: timeline.overdue.length,
    correlativas: correlativasFact(subject, prerequisitesKnown),
    unlocksCount: subject.unlocks.length,
    materialCount,
  }
}

/** "Hoy", "Mañana", "En 3 días". */
export function relativeDayLabel(days: number): string {
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  return `En ${days} días`
}
