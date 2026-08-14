import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

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
  className,
}: {
  subject: SubjectView
  showYear?: boolean
  className?: string
}) {
  const isActive = subject.status === 'in_progress' || subject.status === 'regularized'
  const isMuted = subject.status === 'blocked' || subject.status === 'pending'

  return (
    <Link
      to="/courses/$courseId"
      params={{ courseId: subject.id }}
      className={cn(
        'group border-rule-soft relative flex items-center gap-3 border-b py-3 pr-1 pl-3',
        'hover:bg-paper-elevated transition-colors duration-150',
        'focus-visible:bg-paper-elevated',
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

      <StatusGlyph status={subject.status} />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-sm',
            isMuted ? 'text-ink-muted' : 'text-ink',
            subject.status === 'passed' && 'text-ink-muted',
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
          {subject.status === 'blocked' && subject.missingRequirements.length > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                falta {subject.missingRequirements[0]?.name}
                {subject.missingRequirements.length > 1
                  ? ` +${subject.missingRequirements.length - 1}`
                  : ''}
              </span>
            </>
          ) : null}
          {subject.grade !== null ? (
            <>
              <span aria-hidden="true">·</span>
              <span data-numeric>Nota {subject.grade}</span>
            </>
          ) : null}
        </span>
      </span>

      <ChevronRight
        aria-hidden="true"
        className="text-ink-faint size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
      />
    </Link>
  )
}
