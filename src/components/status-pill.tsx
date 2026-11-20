import type { ReactNode } from 'react'

import { StatusGlyph, statusLabel } from '@/components/academic-status'
import { statusTone } from '@/components/academic-status-vocabulary'
import type { SubjectStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

/** A read-only status in the deck's pill colours (see `statusTone`). */
export function StatusPill({
  status,
  children,
  className,
}: {
  status: SubjectStatus
  /** Replaces the status word, e.g. "Cumplida". The glyph stays the status's own. */
  children?: ReactNode
  className?: string
}) {
  return (
    <span className={cn('status-pill', className)} data-tone={statusTone(status)}>
      <StatusGlyph status={status} className="text-current [&_svg]:size-3.5" />
      {children ?? statusLabel(status)}
    </span>
  )
}
