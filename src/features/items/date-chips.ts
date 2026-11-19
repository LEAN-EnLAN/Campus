import { formatDateInput } from './date-input'

export interface DateChip {
  label: string
  /** dd/mm/aaaa, ready to drop in the date field. */
  date: string
}

const fmt = (d: Date) =>
  formatDateInput({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() })

const addDays = (from: Date, days: number) =>
  new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)

const FRIDAY = 5

/**
 * The quick picks under the date field. `now` is injected so tests are fixed.
 *
 * "Viernes" is the next Friday strictly after today, EXCEPT when today is
 * Friday: then it is today (a student on a Friday who taps "Viernes" means
 * this one, not a week away; "+1 semana" covers the other).
 */
export function quickDateChips(now: Date): DateChip[] {
  const untilFriday = (FRIDAY - now.getDay() + 7) % 7
  return [
    { label: 'Hoy', date: fmt(now) },
    { label: 'Mañana', date: fmt(addDays(now, 1)) },
    { label: 'Viernes', date: fmt(addDays(now, untilFriday)) },
    { label: '+1 semana', date: fmt(addDays(now, 7)) },
  ]
}
