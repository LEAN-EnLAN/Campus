import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { orderConflictOf } from '@/domain/consistency'
import { isFinalBlocked, missingSummary } from '@/domain/requirements'
import type { SubjectView } from '@/domain/types'
import { cn } from '@/lib/utils'

import { statusLabel, StatusGlyph } from './academic-status'

const TERM_LABEL: Record<SubjectView['term'], string> = {
  anual: 'Anual',
  '1c': '1° cuatr.',
  '2c': '2° cuatr.',
}

/**
 * One materia in a list.
 *
 * Three columns that line up down the whole list, so it scans like a table
 * without being one: the status glyph (its shape says where the student is),
 * the name, and on the right the year/term and the status control. Every column
 * is centred on the same axis, and the whole row is the link.
 */
export function SubjectRow({
  subject,
  showYear = false,
  control,
  className,
}: {
  subject: SubjectView
  showYear?: boolean
  /**
   * An inline control (the status chip). It sits NEXT to the link, never inside
   * it: a button nested in an anchor is invalid and unreachable by keyboard. It
   * is raised above the link's full-row hit area.
   */
  control?: ReactNode
  className?: string
}) {
  const isMuted =
    subject.status === 'blocked' ||
    subject.status === 'passed' ||
    subject.status === 'equivalent'
  const missing = missingSummary(subject)
  // A subject we think is blocked says what is missing. One the student marked
  // anyway is not "blocked": it carries the quiet "correlativas pendientes" flag.
  const notes = [
    // Without a control the row is the only place the status is written.
    control ? null : statusLabel(subject.status),
    subject.status === 'blocked' ? missing : null,
    isFinalBlocked(subject) ? 'final bloqueado' : null,
    orderConflictOf(subject) ? 'correlativas pendientes' : null,
    subject.elective ? 'Electiva' : null,
    subject.grade !== null ? `Nota ${subject.grade}` : null,
  ].filter((note): note is string => note !== null)
  const when = [showYear ? `${subject.yearLevel}° año` : null, TERM_LABEL[subject.term]]
    .filter((part): part is string => part !== null)
    .join(' · ')

  return (
    <div
      className={cn(
        'group relative flex min-h-12 items-center gap-3 rounded-md px-3 py-1.5',
        'hover:bg-paper-sunken/70 focus-within:bg-paper-sunken/70 transition-colors duration-150',
        className,
      )}
    >
      <StatusGlyph status={subject.status} />

      <Link
        to="/courses/$courseId"
        params={{ courseId: subject.id }}
        className={cn(
          // The whole row is the target; the ring follows the row, not the text.
          'grid min-w-0 flex-1 gap-x-4 gap-y-0.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center',
          'after:absolute after:inset-0 after:rounded-md',
          'focus-visible:after:outline-focus focus-visible:outline-none! focus-visible:after:outline-2 focus-visible:after:-outline-offset-2',
        )}
      >
        <span
          className={cn(
            'min-w-0 text-sm font-medium break-words',
            isMuted ? 'text-ink-muted' : 'text-ink',
          )}
        >
          {subject.name}
        </span>
        <span
          className="text-ink-muted text-xs lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:text-right"
          data-numeric
        >
          {when}
        </span>
        {notes.length > 0 ? (
          <span className="text-ink-muted text-xs lg:col-start-1">{notes.join(' · ')}</span>
        ) : null}
      </Link>

      {control ? (
        // A fixed-width, right-aligned column: chips of different lengths must
        // not push the year/term column around, so both line up down the list.
        <div className="relative z-10 flex shrink-0 items-center justify-end lg:min-w-44">
          {control}
        </div>
      ) : (
        <ChevronRight
          aria-hidden="true"
          className="text-ink-faint size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
        />
      )}
    </div>
  )
}
