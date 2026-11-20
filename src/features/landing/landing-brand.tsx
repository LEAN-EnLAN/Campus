import { CampusLogo } from '@/components/brand/campus-logo'
import { cn } from '@/lib/utils'

/**
 * The lockup at the pitch deck's proportions: mark 1.6em of the wordmark,
 * gap 0.4em, weight 600, tracking -0.017em. Size it with `font-size` on the
 * caller; `.lp-lockup` in landing.css holds the proportions and the colours.
 */
export function Lockup({ tone, className }: { tone: 'light' | 'dark'; className?: string }) {
  return (
    <CampusLogo
      wordmark
      tone={tone}
      className={cn('lp-lockup', className)}
      markClassName="lp-lockup-mark"
    />
  )
}

/**
 * The deck's signature: the giant C on navy, bleeding off the right edge. It
 * draws itself once (the arc, then the dot) and stays put; with reduced motion
 * it is simply there. Geometry is the mark's own (public/brand/campus-mark.svg).
 */
export function WatermarkC({
  className,
  animate = true,
}: {
  className?: string
  animate?: boolean
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('lp-watermark', animate && 'lp-watermark--draw', className)}
      aria-hidden
      focusable="false"
    >
      <g transform="translate(0.4 -2)">
        <path
          className="lp-watermark-arc"
          d="M39.39 16.34 A20 20 0 1 0 48.54 41.49"
          pathLength={100}
        />
        <circle className="lp-watermark-dot" cx="50.67" cy="26.48" r="7" />
      </g>
    </svg>
  )
}

export type PillStatus = 'ok' | 'cur' | 'reg' | 'dis'

/** The product's status vocabulary, as the deck uses it: a pill per state. */
export function StatusPill({ status, children }: { status: PillStatus; children: string }) {
  return (
    <span className="lp-pill" data-status={status}>
      {children}
    </span>
  )
}
