import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'

import type { AcademicItem } from '@/domain/types'
import { dueTimeLabel } from '@/features/items/due'
import { icsUnavailableReason } from '@/features/items/ics'
import { itemKindLabel } from '@/features/items/kind-label'
import { cn } from '@/lib/utils'

import { ItemRowActions } from './item-row-actions'

// Re-exported: rows across the app import the label from here.
export { itemKindLabel }

/**
 * One obligation in the agenda.
 *
 * The time sits in a fixed-width tabular column so a list of five deadlines reads
 * as a schedule rather than as ragged prose.
 */
export function DeadlineRow({
  item,
  subjectName,
  subjectId,
  onToggle,
  onShare,
  onDownloadIcs,
  togglePending = false,
  onEdit,
  onDelete,
  overdue = false,
  dayLabel,
  className,
}: {
  item: AcademicItem
  subjectName?: string | null
  subjectId?: string | null
  onToggle?: (done: boolean) => void
  onShare?: () => void
  onDownloadIcs?: () => void
  /** The change is in flight: the circle waits instead of taking a second tap. */
  togglePending?: boolean
  onEdit?: () => void
  onDelete?: () => void
  overdue?: boolean
  /**
   * Which day this falls on. Required outside a section that already states the
   * day — "Próximamente · 09:00" without a day tells the student nothing.
   */
  dayLabel?: string | null
  className?: string
}) {
  // Only a time the student typed. An item saved with just a date has none, and
  // showing the end-of-day that stands in for it would invent a deadline hour.
  const time = dueTimeLabel(item)
  const done = item.status === 'done'

  return (
    // A container, so the row answers to its OWN width: in a narrow column the
    // actions drop under the title instead of squeezing it to a sliver and
    // pushing the whole page sideways (360px phones scrolled to 414px).
    <div className={cn('group border-rule-soft @container border-b py-3', className)}>
      <div className="flex flex-wrap items-start gap-x-3">
        {onToggle ? (
          <button
            type="button"
            onClick={() => onToggle(!done)}
            aria-pressed={done}
            disabled={togglePending}
            aria-busy={togglePending}
            className={cn(
              'relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
              'disabled:cursor-progress disabled:opacity-50',
              // The circle stays 20px because a 44px ring would wreck the row rhythm,
              // but the HIT AREA is expanded to 44px with a pseudo-element. This is the
              // most-tapped control in the app and it is used with a thumb.
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
        ) : null}

        <span
          data-numeric
          className={cn(
            'mt-0.5 w-11 shrink-0 text-xs',
            overdue ? 'text-danger font-medium' : 'text-ink-muted',
          )}
        >
          {time ?? (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">Sin hora</span>
            </>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              // A long token ("TP 1794627566315") breaks rather than setting a minimum width.
              'block text-sm wrap-anywhere',
              done ? 'text-ink-muted line-through' : 'text-ink',
            )}
          >
            {item.title}
          </span>
          <span className="text-ink-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            {dayLabel ? (
              <>
                <span className="text-ink font-medium">{dayLabel}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span>{itemKindLabel(item.kind)}</span>
            {subjectName ? (
              <>
                <span aria-hidden="true">·</span>
                {subjectId ? (
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: subjectId }}
                    className="hover:text-ink truncate underline-offset-4 hover:underline"
                  >
                    {subjectName}
                  </Link>
                ) : (
                  <span className="truncate">{subjectName}</span>
                )}
              </>
            ) : null}
            {overdue ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-danger font-medium">Atrasada</span>
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
          className="@max-md:mt-1 @max-md:mb-0 @max-md:basis-full @max-md:justify-end"
        />
      </div>
    </div>
  )
}
