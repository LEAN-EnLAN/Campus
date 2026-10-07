import { Check } from 'lucide-react'

import { itemKindLabel } from '@/components/deadline-row'
import { describeItemDate } from '@/domain/item-dates'
import type { AcademicItem } from '@/domain/types'
import { dueTimeLabel } from '@/features/items/due'
import { cn } from '@/lib/utils'

/**
 * One row of a subject's "Fechas": the DATE first, the time only if one was set.
 *
 * Deliberately not `DeadlineRow`: that row is a schedule (time column, "—"
 * placeholder) built for a list already grouped by day. Here nothing groups the
 * rows, so the date is the first thing you read.
 */
export function SubjectDateRow({
  item,
  onToggle,
}: {
  item: AcademicItem
  onToggle: (done: boolean) => void
}) {
  const date = describeItemDate(item)
  const time = dueTimeLabel(item)
  const done = item.status === 'done'
  const undated = date === 'Sin fecha'

  return (
    <div className="group border-rule-soft flex items-start gap-3 border-b py-3">
      <button
        type="button"
        onClick={() => onToggle(!done)}
        aria-pressed={done}
        className={cn(
          'relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
          "before:absolute before:-inset-3 before:content-['']",
          done
            ? 'border-success bg-success text-on-tint'
            : 'border-rule hover:border-ink-faint text-transparent',
        )}
      >
        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
        <span className="sr-only">
          {done ? `Marcar ${item.title} como pendiente` : `Marcar ${item.title} como hecho`}
        </span>
      </button>

      <span
        data-numeric
        className={cn('mt-0.5 w-24 shrink-0 text-xs', undated ? 'text-ink-faint' : 'text-ink')}
      >
        {date}
        {time ? <span className="text-ink-muted"> · {time}</span> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn('block text-sm', done ? 'text-ink-muted line-through' : 'text-ink')}
        >
          {item.title}
        </span>
        <span className="text-ink-muted mt-0.5 block text-xs">{itemKindLabel(item.kind)}</span>
      </span>
    </div>
  )
}
