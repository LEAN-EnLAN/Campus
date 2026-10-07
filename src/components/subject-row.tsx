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
 * A row with a hairline, not a card — a plan is a list of 40 things, and 40 cards
 * is a wall. The leading accent rule marks what the student is cursando, so the
 * active subjects are findable without reading a single label.
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
   * An inline control (the status buttons). It sits NEXT to the link, never
   * inside it: a button nested in an anchor is invalid and unreachable by keyboard.
   */
  control?: ReactNode
  className?: string
}) {
  const isActive = subject.status === 'in_progress' || subject.status === 'regularized'
  const isMuted = subject.status === 'blocked' || subject.status === 'pending'
  const missing = missingSummary(subject)
  // A subject we think is blocked says what is missing. One the student marked
  // anyway is not "blocked": it carries the quiet "correlativas pendientes" flag.
  const hints = [
    subject.status === 'blocked' ? missing : null,
    isFinalBlocked(subject) ? 'final bloqueado' : null,
    orderConflictOf(subject) ? 'correlativas pendientes' : null,
    subject.elective ? 'Electiva' : null,
  ].filter((hint): hint is string => hint !== null)

  return (
    <div
      className={cn(
        'group border-rule-soft relative flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-3 pr-1 pl-3',
        'hover:bg-paper-elevated focus-within:bg-paper-elevated transition-colors duration-150',
        className,
      )}
    >
      {/* Active marker: a rule on the leading edge, never a filled block. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1 bottom-1 left-0 w-0.5 rounded-full transition-colors',
          isActive ? 'bg-accent' : 'bg-transparent',
        )}
      />

      <Link
        to="/courses/$courseId"
        params={{ courseId: subject.id }}
        className="flex min-w-0 flex-1 basis-56 items-center gap-3"
      >
        <StatusGlyph status={subject.status} />

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-sm',
              isMuted ? 'text-ink-muted' : 'text-ink',
              subject.status === 'passed' && 'text-ink-muted',
              control ? 'group-hover:underline' : null,
            )}
          >
            {subject.name}
          </span>

          <span className="text-ink-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {/* The status text is what makes this readable without colour. */}
            <span>{statusLabel(subject.status)}</span>
            {showYear ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{subject.yearLevel}° año</span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span>{TERM_LABEL[subject.term]}</span>
            {hints.map((hint) => (
              <span key={hint} className="contents">
                <span aria-hidden="true">·</span>
                <span>{hint}</span>
              </span>
            ))}
            {subject.grade !== null ? (
              <>
                <span aria-hidden="true">·</span>
                <span data-numeric>Nota {subject.grade}</span>
              </>
            ) : null}
          </span>
        </span>

        {control ? null : (
          <ChevronRight
            aria-hidden="true"
            className="text-ink-faint size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
          />
        )}
      </Link>

      {control}
    </div>
  )
}
