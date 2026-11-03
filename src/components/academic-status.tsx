import { statusLabel } from '@/domain/status-groups'
import type { SubjectStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

import { STATUS } from './academic-status-vocabulary'

// The wording lives in the domain; re-exported so screens keep one import.
export { statusLabel }

/**
 * The status glyph on its own.
 *
 * `aria-hidden` because a label next to it (visible or accessible) already
 * carries the meaning; announcing "círculo" would only add noise.
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
        spec.tone,
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={2} />
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
    <span className={cn('inline-flex items-center gap-1.5 text-xs', spec.tone, className)}>
      <StatusGlyph status={status} />
      {statusLabel(status)}
    </span>
  )
}
