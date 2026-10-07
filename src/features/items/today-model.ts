import { buildAgenda, type AgendaEntry } from '@/domain/agenda'
import type { AcademicItem } from '@/domain/types'

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
  undated: AgendaEntry[]
}

export function buildToday(items: readonly AcademicItem[], now: Date): TodayModel {
  const agenda = buildAgenda(items, now)
  const upcoming = [...agenda.tomorrow, ...agenda.week, ...agenda.later]
    .filter((entry) => (entry.dayOffset ?? Infinity) <= UPCOMING_DAYS)
    .map((entry) => ({ ...entry, daysLeft: entry.dayOffset as number }))

  return { overdue: agenda.overdue, today: agenda.today, upcoming, undated: agenda.undated }
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
