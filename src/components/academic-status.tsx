import {
  ArrowLeftRight,
  CheckCircle2,
  Circle,
  CircleDot,
  CircleHelp,
  Clock3,
  LockKeyhole,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

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
  Icon: LucideIcon
  className: string
}

const STATUS: Record<SubjectStatus, StatusSpec> = {
  passed: { Icon: CheckCircle2, className: 'text-success-ink' },
  equivalent: { Icon: ArrowLeftRight, className: 'text-success-ink' },
  in_progress: { Icon: CircleDot, className: 'text-accent-ink' },
  regularized: { Icon: Clock3, className: 'text-accent-ink' },
  available: { Icon: Circle, className: 'text-ink' },
  pending: { Icon: CircleHelp, className: 'text-ink-muted' },
  blocked: { Icon: LockKeyhole, className: 'text-ink-muted' },
  failed: { Icon: XCircle, className: 'text-danger' },
}

// The wording lives in the domain; re-exported so screens keep one import.
export { statusLabel }

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
  const Icon = spec.Icon

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center',
        spec.className,
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={1.9} />
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
