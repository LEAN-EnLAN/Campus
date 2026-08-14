import { cn } from '@/lib/utils'

/**
 * Career progress — a rule that fills, not a KPI card.
 *
 * The bar is decorative; the number beside it is the real content, so screen
 * readers get "28 de 39 materias" rather than a percentage they cannot see.
 */
export function ProgressLine({
  value,
  total,
  label = 'materias',
  name,
  className,
}: {
  value: number
  total: number
  label?: string
  /** Accessible name for the bar. Defaults to "Progreso: <label>". */
  name?: string
  className?: string
}) {
  const ratio = total === 0 ? 0 : value / total
  const percent = Math.round(ratio * 100)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-ink" data-numeric>
          <strong className="font-medium">{value}</strong>
          <span className="text-ink-muted"> / {total} </span>
          <span className="text-ink-muted">{label}</span>
        </span>
        <span className="text-ink-muted text-xs" data-numeric>
          {percent}%
        </span>
      </div>

      {/* A progressbar needs an accessible NAME, not just a value — axe is right
          to insist: "45%" on its own tells a screen-reader user nothing. */}
      <div
        role="progressbar"
        aria-label={name ?? `Progreso: ${label}`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuetext={`${value} de ${total} ${label}`}
        className="bg-rule-soft h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-accent h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-quiet)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
