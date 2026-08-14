import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Page header — editorial, not a dashboard banner.
 *
 * The serif title is the one place per screen where Campus reads like a notebook
 * rather than an app. `eyebrow` carries the academic context above it.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-ink-muted mb-1 text-xs font-medium tracking-wide uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-ink font-serif text-2xl leading-tight font-medium sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-ink-muted mt-1.5 max-w-prose text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** A quiet section label with a hairline running to the edge of the surface. */
export function SectionHeading({
  children,
  aside,
  id,
  className,
}: {
  children: ReactNode
  aside?: ReactNode
  id?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline gap-3', className)}>
      <h2 id={id} className="text-2xs text-ink-muted font-semibold tracking-[0.12em] uppercase">
        {children}
      </h2>
      <span aria-hidden="true" className="bg-rule-soft h-px flex-1" />
      {aside ? <span className="text-ink-muted text-xs">{aside}</span> : null}
    </div>
  )
}
