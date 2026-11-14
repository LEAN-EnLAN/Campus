import { buildAgenda, type AgendaEntry } from '@/domain/agenda'
import type { AcademicItem } from '@/domain/types'

import { dueDateLabel } from './due'

/**
 * What Hoy shows, decided in one place.
 *
 * Built on the domain's `buildAgenda` (read-only) and adding the two things Hoy
 * was missing: a 14-day "upcoming" window with days left, and the undated items
 * the calendar already promises are "en Hoy".
 */

/** How far ahead Hoy looks. Two weeks covers "the parcial after next". */
export const UPCOMING_DAYS = 14

export interface UpcomingEntry extends AgendaEntry {
  daysLeft: number
}

export interface TodayModel {
  overdue: AgendaEntry[]
  today: AgendaEntry[]
  upcoming: UpcomingEntry[]
  /**
   * Open items past the 14-day window, soonest first. Never dropped: Hoy used
   * to forget them, and with nothing closer it then told the student they had
   * nothing pending at all.
   */
  later: UpcomingEntry[]
  undated: AgendaEntry[]
  /** The soonest open item from tomorrow on, however far. */
  next: UpcomingEntry | null
  /** Every open item, dated or not. Zero is the only "nothing pending". */
  openCount: number
}

export function buildToday(items: readonly AcademicItem[], now: Date): TodayModel {
  const agenda = buildAgenda(items, now)
  const ahead = [...agenda.tomorrow, ...agenda.week, ...agenda.later].map((entry) => ({
    ...entry,
    daysLeft: entry.dayOffset as number,
  }))
  const upcoming = ahead.filter((entry) => entry.daysLeft <= UPCOMING_DAYS)
  const later = ahead.filter((entry) => entry.daysLeft > UPCOMING_DAYS)

  return {
    overdue: agenda.overdue,
    today: agenda.today,
    upcoming,
    later,
    undated: agenda.undated,
    next: ahead[0] ?? null,
    openCount:
      agenda.overdue.length + agenda.today.length + ahead.length + agenda.undated.length,
  }
}

/**
 * "Más adelante: 3 fechas · la próxima es Final (Álgebra), 20/11".
 *
 * The one line that stands for everything past the window, so nothing open is
 * ever hidden from Hoy; the list itself is one click away.
 */
export function laterLine(
  later: readonly UpcomingEntry[],
  subjectName: (subjectId: string | null) => string | null,
): string | null {
  const first = later[0]
  if (!first) return null
  const count = later.length === 1 ? '1 fecha' : `${later.length} fechas`
  const subject = subjectName(first.item.curriculumSubjectId)
  const what = subject ? `${first.item.title} (${subject})` : first.item.title
  return `Más adelante: ${count} · la próxima es ${what}, ${dueDateLabel(first.item)}`
}

/** "Mañana", "En 10 días". */
export function daysLeftLabel(daysLeft: number): string {
  return daysLeft === 1 ? 'Mañana' : `En ${daysLeft} días`
}

export interface Headline {
  title: string
  description?: string
}

/**
 * The one honest sentence at the top.
 *
 * "No tenés nada para hoy" is only true when nothing is coming either; with a
 * parcial in three days it reassures a student into not looking.
 */
export function todayHeadline({
  dueToday,
  upcoming,
  undated,
}: {
  dueToday: number
  upcoming: readonly { title: string; daysLeft: number }[]
  undated: number
}): Headline {
  if (dueToday === 1) return { title: 'Tenés una cosa para hoy.' }
  if (dueToday > 1) return { title: `Tenés ${dueToday} cosas para hoy.` }

  const next = upcoming[0]
  if (next) {
    const when = next.daysLeft === 1 ? 'mañana' : `en ${next.daysLeft} días`
    return { title: 'Nada para hoy.', description: `Lo próximo: ${next.title}, ${when}.` }
  }
  if (undated > 0) return { title: 'Nada con fecha para hoy.' }

  return {
    title: 'No tenés nada para hoy.',
    description: 'Buen momento para adelantar algo, o para no hacer nada.',
  }
}
