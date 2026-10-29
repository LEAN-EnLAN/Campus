import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Native details retains keyboard and screen-reader semantics; its initial
 * visibility is a one-time decision, not reset by a status refetch. */
export function AcademicYearDisclosure({
  year,
  summary,
  initiallyOpen = false,
  children,
  className,
}: {
  year: number
  summary: string
  initiallyOpen?: boolean
  children: ReactNode
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen)
  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className={cn('blue-panel blue-year-group group min-w-0', className)}
    >
      <summary className="blue-year-toggle flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-2 font-semibold">
        <span>{year}° año</span>
        <span className="text-ink-muted flex items-center gap-2 text-xs font-normal">
          {summary}
          <ChevronDown aria-hidden="true" className="blue-year-chevron" />
        </span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}
