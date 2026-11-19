import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** A decorative lucide icon before the label. */
  icon?: ReactNode
}

/**
 * A small set of mutually exclusive choices shown side by side (Claro / Oscuro /
 * Sistema). Toggle buttons with `aria-pressed` inside a named group: every
 * option is reachable with Tab and announced as "pressed" or not, which reads
 * better than a radio group for two to four short words.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** Names the group for assistive tech. */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'bg-paper-sunken border-rule-soft inline-flex w-full gap-1 rounded-xl border p-1',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium',
              'ease-out-expo transition-[background-color,color,box-shadow] duration-150',
              'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
              '[&_svg]:size-4 [&_svg]:shrink-0',
              selected
                ? 'bg-paper-elevated text-ink shadow-raised'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.icon ? <span aria-hidden="true">{option.icon}</span> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
