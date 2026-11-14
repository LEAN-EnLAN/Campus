import { Check } from 'lucide-react'

import { itemKindLabel } from '@/components/deadline-row'
import { ItemRowActions } from '@/components/item-row-actions'
import { describeItemDate } from '@/domain/item-dates'
import type { AcademicItem } from '@/domain/types'
import { dueTimeLabel } from '@/features/items/due'
import { icsUnavailableReason } from '@/features/items/ics'
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
  onShare,
  onDownloadIcs,
  togglePending = false,
  onEdit,
  onDelete,
}: {
  item: AcademicItem
  onToggle: (done: boolean) => void
  onShare?: () => void
  onDownloadIcs?: () => void
  togglePending?: boolean
  onEdit?: () => void
  onDelete?: () => void
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
        disabled={togglePending}
        aria-busy={togglePending}
        className={cn(
          'relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
          'disabled:cursor-progress disabled:opacity-50',
          'before:absolute before:-inset-3',
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

      <ItemRowActions
        title={item.title}
        onShare={onShare}
        onDownloadIcs={onDownloadIcs}
        icsDisabledReason={icsUnavailableReason(item)}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}
