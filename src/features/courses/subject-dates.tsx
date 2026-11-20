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
  relative = null,
  overdue = false,
}: {
  item: AcademicItem
  onToggle: (done: boolean) => void
  onShare?: () => void
  onDownloadIcs?: () => void
  togglePending?: boolean
  onEdit?: () => void
  onDelete?: () => void
  /** "Mañana", "En 9 días", "Atrasada" — said after the kind. */
  relative?: string | null
  /** Past its date and still open: the relative label reads as a warning. */
  overdue?: boolean
}) {
  const date = describeItemDate(item)
  const time = dueTimeLabel(item)
  const done = item.status === 'done'
  const undated = date === 'Sin fecha'

  return (
    <div
      className="course-date group"
      data-done={done ? '' : undefined}
      data-overdue={overdue ? '' : undefined}
    >
      <span data-numeric className={cn('course-date-when', undated && 'is-undated')}>
        {date}
        {time ? (
          <span className="course-date-time">
            <span className="sr-only"> · </span>
            {time}
          </span>
        ) : null}
      </span>

      <span className="course-date-rail">
        <button
          type="button"
          onClick={() => onToggle(!done)}
          aria-pressed={done}
          disabled={togglePending}
          aria-busy={togglePending}
          className={cn(
            'bg-paper-elevated relative flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
            'disabled:cursor-progress disabled:opacity-50',
            'before:absolute before:-inset-3',
            done
              ? 'border-success bg-success text-on-tint'
              : 'border-field hover:border-accent hover:text-accent text-transparent',
          )}
        >
          <Check aria-hidden="true" className="size-3" strokeWidth={3} />
          <span className="sr-only">
            {done ? `Marcar ${item.title} como pendiente` : `Marcar ${item.title} como hecho`}
          </span>
        </button>
      </span>

      <span className="course-date-body">
        <span className={cn('course-date-title', done && 'is-done')}>{item.title}</span>
        <span className="course-date-meta">
          {itemKindLabel(item.kind)}
          {relative ? (
            <>
              {' · '}
              <span className={overdue ? 'text-danger font-medium' : undefined}>
                {relative}
              </span>
            </>
          ) : null}
        </span>
      </span>

      <ItemRowActions
        title={item.title}
        onShare={onShare}
        onDownloadIcs={onDownloadIcs}
        icsDisabledReason={icsUnavailableReason(item)}
        onEdit={onEdit}
        onDelete={onDelete}
        className="course-date-actions"
      />
    </div>
  )
}
