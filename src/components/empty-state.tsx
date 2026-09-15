import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Empty state — no mascot, no illustration, direct academic language.
 *
 * An empty screen is a normal state, not an error, so it reads calm rather than
 * apologetic.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-rule flex flex-col items-start gap-2 rounded-lg border border-dashed px-5 py-8',
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="text-ink-faint size-5" /> : null}
      <p className="text-ink font-serif text-lg">{title}</p>
      {description ? <p className="text-ink-muted max-w-prose text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/** Skeleton rows for a loading list — same rhythm as the real rows. */
export function LoadingRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="border-rule-soft flex items-center gap-3 border-b py-3.5">
          <span className="bg-rule-soft size-3 shrink-0 rounded-full" />
          <span
            className="bg-rule-soft h-3.5 rounded"
            style={{ width: `${52 + ((i * 13) % 28)}%` }}
          />
        </div>
      ))}
    </div>
  )
}

/** A failed query, phrased for a student rather than for a log. */
export function ErrorState({
  title = 'No pudimos cargar esto',
  error,
  onRetry,
  className,
}: {
  title?: string
  error?: Error | null
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'border-danger/25 bg-danger-soft rounded-lg border px-5 py-4 text-sm',
        className,
      )}
    >
      <p className="text-danger font-medium">{title}</p>
      {error ? <p className="text-ink-muted mt-1">{error.message}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-accent-ink mt-2 text-sm font-medium underline-offset-4 hover:underline"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  )
}
