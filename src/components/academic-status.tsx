import { Lock } from 'lucide-react'

import { statusLabel } from '@/domain/status-groups'
import type { SubjectStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

/**
 * Colour is never the only carrier of state.
 *
 * Every status renders a glyph AND a Spanish label. A colour-blind student, a
 * greyscale print and a screen reader all get the same information.
 */

interface StatusSpec {
  glyph: string
  className: string
}

const STATUS: Record<SubjectStatus, StatusSpec> = {
  passed: { glyph: '✓', className: 'text-success-ink' },
  equivalent: { glyph: '≡', className: 'text-success-ink' },
  in_progress: { glyph: '●', className: 'text-accent-ink' },
  regularized: { glyph: '◐', className: 'text-accent-ink' },
  available: { glyph: '○', className: 'text-ink' },
  pending: { glyph: '◌', className: 'text-ink-muted' },
  blocked: { glyph: '', className: 'text-ink-muted' },
  failed: { glyph: '✕', className: 'text-danger' },
}

// The wording lives in the domain; re-exported so screens keep one import.
export { statusLabel }

/** The glyph character, for controls that colour it themselves. */
export function statusGlyph(status: SubjectStatus): string {
  return STATUS[status].glyph
}

/**
 * The status glyph on its own.
 *
 * `aria-hidden` because the visible label next to it already carries the meaning —
 * announcing "círculo lleno" would only add noise.
 */
export function StatusGlyph({
  status,
  className,
}: {
  status: SubjectStatus
  className?: string
}) {
  const spec = STATUS[status]

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex w-4 shrink-0 justify-center text-[0.8em] leading-none select-none',
        spec.className,
        className,
      )}
    >
      {status === 'blocked' ? <Lock className="size-3" strokeWidth={2} /> : spec.glyph}
    </span>
  )
}

/** Glyph + label, for places where the status needs to be read, not just scanned. */
export function AcademicStatus({
  status,
  className,
}: {
  status: SubjectStatus
  className?: string
}) {
  const spec = STATUS[status]

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', spec.className, className)}>
      <StatusGlyph status={status} />
      {statusLabel(status)}
    </span>
  )
}
