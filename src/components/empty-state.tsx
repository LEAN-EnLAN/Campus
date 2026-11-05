import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Illustration } from '@/components/ui/illustration'
import type { IllustrationName } from '@/components/ui/illustrations'
import { cn } from '@/lib/utils'

/**
 * Quiet academic empty state. The illustration is a registry name, so the
 * surface gets the raster when one exists and never hard-codes a file. It is
 * decorative: the title beside it already says what it shows.
 */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  quiet = false,
  className,
}: {
  icon?: LucideIcon
  /** A key of the illustration registry, e.g. `courses-empty`. */
  illustration?: IllustrationName
  /** The sentence. One. */
  title: string
  description?: string
  /** At most one. */
  action?: ReactNode
  /** No dashed box, for inside a section that already has its own heading. */
  quiet?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-2',
        quiet ? 'py-3' : 'border-rule rounded-lg border border-dashed px-5 py-8',
        className,
      )}
    >
      {illustration ? (
        <Illustration name={illustration} decorative size={quiet ? 'sm' : 'md'} />
      ) : null}
      {Icon ? <Icon aria-hidden="true" className="text-ink-faint size-5" /> : null}
      <p className={quiet ? 'text-ink-muted text-sm' : 'text-ink font-serif text-lg'}>
        {title}
      </p>
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
  illustration,
  className,
}: {
  title?: string
  error?: Error | null
  onRetry?: () => void
  /** Only when the error IS the screen (nothing else loaded); decorative, above the alert. */
  illustration?: IllustrationName
  className?: string
}) {
  const alert = (
    <div
      role="alert"
      className={cn(
        'border-danger/25 bg-danger-soft rounded-lg border px-5 py-4 text-sm',
        illustration ? 'w-full' : className,
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
  if (!illustration) return alert
  return (
    <div className={cn('flex flex-col items-start gap-3', className)}>
      <Illustration name={illustration} decorative size="sm" />
      {alert}
    </div>
  )
}
