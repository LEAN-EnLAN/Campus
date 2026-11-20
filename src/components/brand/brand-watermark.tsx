import { cn } from '@/lib/utils'

/**
 * The giant Campus C behind a navy hero surface (the pitch deck's cover
 * device): the mark's own geometry, arc one step above navy, blue dot, drawn
 * once on mount (static under reduced motion). Decorative — it never carries
 * meaning, so it is hidden from assistive tech.
 *
 * The surface must be `position: relative; overflow: hidden` and lift its
 * content above it; the caller places and sizes it with `className`, letting it
 * bleed off the right edge.
 */
export function BrandWatermark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('brand-watermark', className)}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(0.4 -2)">
        <path
          className="brand-watermark-arc"
          d="M39.39 16.34 A20 20 0 1 0 48.54 41.49"
          pathLength={100}
        />
        <circle className="brand-watermark-dot" cx="50.67" cy="26.48" r="7" />
      </g>
    </svg>
  )
}
