import { itemKindLabel } from '@/components/deadline-row'
import { EmptyState } from '@/components/empty-state'
import type { AcademicItem } from '@/domain/types'
import { dueTimeLabel } from '@/features/items/due'
import { cn } from '@/lib/utils'

import { buildAgendaDays } from './agenda-days'

/**
 * The agenda: what is coming, from today on.
 *
 * Ours rather than the calendar library's. Its agenda covers a fixed window from
 * wherever you happen to be, writes "Starts" and "Ends" in English for anything
 * that crosses midnight, has no sentence for an empty range, and carries a
 * header that names a different period than the one listed. A list this simple
 * is cheaper to get right than to bend.
 */

const HEADER_FORMAT = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' })
const DAY_FORMAT = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function AgendaList({
  items,
  now,
  subjectName,
  onToggle,
}: {
  items: readonly AcademicItem[]
  now: Date
  subjectName: (item: AcademicItem) => string | null
  onToggle?: (item: AcademicItem, done: boolean) => void
}) {
  const days = buildAgendaDays(items, now)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
      <h3 className="text-ink font-serif text-lg font-semibold">
        Desde hoy, {HEADER_FORMAT.format(now)}
      </h3>

      {days.length === 0 ? (
        <EmptyState quiet title="No tenés nada agendado de hoy en adelante." />
      ) : (
        <div className="mt-2 flex flex-col gap-5">
          {days.map((day) => (
            <section key={day.date.getTime()} className="flex flex-col">
              <h4 className="text-2xs text-ink-muted border-rule-soft border-b py-2 font-semibold tracking-[0.12em] uppercase">
                {capitalize(DAY_FORMAT.format(day.date))}
              </h4>
              <ul>
                {day.items.map((item) => {
                  const time = dueTimeLabel(item)
                  const subject = subjectName(item)
                  const done = item.status === 'done'
                  return (
                    <li
                      key={item.id}
                      className="border-rule-soft flex items-baseline gap-3 border-b py-2.5"
                    >
                      <span data-numeric className="text-ink-muted w-16 shrink-0 text-xs">
                        {time ?? 'Todo el día'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-sm',
                            done ? 'text-ink-muted line-through' : 'text-ink',
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="text-ink-muted block text-xs">
                          {[itemKindLabel(item.kind), subject].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {onToggle ? (
                        <button
                          type="button"
                          onClick={() => onToggle(item, !done)}
                          className="text-accent-ink min-h-8 shrink-0 text-xs font-medium underline-offset-4 hover:underline"
                        >
                          {done ? 'Marcar pendiente' : 'Marcar hecho'}
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
