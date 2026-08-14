import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'

import type { AcademicItem, AcademicItemKind } from '@/domain/types'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<AcademicItemKind, string> = {
  task: 'Tarea',
  assignment: 'Entrega',
  midterm: 'Parcial',
  final: 'Final',
  registration: 'Inscripción',
  class: 'Clase',
  custom: 'Otro',
}

export function itemKindLabel(kind: AcademicItemKind): string {
  return KIND_LABEL[kind]
}

/** `HH:MM` in local time, or null for an all-day item. */
function timeOf(item: AcademicItem): string | null {
  const anchor = item.dueAt ?? item.startsAt
  if (!anchor) return null
  const date = new Date(anchor)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

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
  overdue = false,
  className,
}: {
  item: AcademicItem
  subjectName?: string | null
  subjectId?: string | null
  onToggle?: (done: boolean) => void
  overdue?: boolean
  className?: string
}) {
  const time = timeOf(item)
  const done = item.status === 'done'

  return (
    <div
      className={cn('group border-rule-soft flex items-start gap-3 border-b py-3', className)}
    >
      {onToggle ? (
        <button
          type="button"
          onClick={() => onToggle(!done)}
          aria-pressed={done}
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
            done
              ? 'border-success bg-success text-white'
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
        {time ?? '—'}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn('block text-sm', done ? 'text-ink-muted line-through' : 'text-ink')}
        >
          {item.title}
        </span>
        <span className="text-ink-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
          <span>{KIND_LABEL[item.kind]}</span>
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
    </div>
  )
}
