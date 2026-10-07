import { orderConflictMessage, orderConflictOf } from '@/domain/consistency'
import type { SubjectView } from '@/domain/types'
import { cn } from '@/lib/utils'

import { useDismissedNotes } from './dismissed-notes'

/**
 * The one quiet line that says "the plan disagrees with what you marked".
 *
 * Never a modal, never red, never blocking: the student may well hold an
 * equivalencia we do not know about. With `dismissible` it carries a dismiss
 * control; without it (Tablero cards, which are themselves buttons) it is plain
 * text and obeys the dismissal made elsewhere.
 */
export function OrderConflictNote({
  subject,
  dismissible = false,
  className,
}: {
  subject: SubjectView
  dismissible?: boolean
  className?: string
}) {
  const { isDismissed, dismiss } = useDismissedNotes()
  const conflict = orderConflictOf(subject)
  if (!conflict || isDismissed(conflict.key)) return null

  return (
    <p
      role="note"
      className={cn(
        'border-rule bg-paper-elevated text-ink-muted flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-dashed px-3 py-2 text-sm',
        className,
      )}
    >
      <span className="min-w-0 flex-1">{orderConflictMessage(conflict)}</span>
      {dismissible ? (
        <button
          type="button"
          onClick={() => dismiss(conflict.key)}
          className="text-accent-ink shrink-0 text-sm underline underline-offset-4"
        >
          Descartar aviso
        </button>
      ) : null}
    </p>
  )
}
