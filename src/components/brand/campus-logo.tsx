import { cn } from '@/lib/utils'

/**
 * The Campus mark: a C arc and a dot, drawn inline so it takes the surface's
 * colours. Geometry is copied from `public/brand/campus-mark.svg` (the approved
 * source of truth) and must stay identical to it — see DESIGN_SYSTEM.md, Brand.
 *
 *   tone="light"  navy arc + blue dot, for white and pale-blue surfaces
 *   tone="dark"   white arc + light-blue dot, for the navy shell
 *
 * Colours come from `--brand-*` tokens via `brand.css`; the arc is `currentColor`,
 * so a surface can still recolour it by setting `color`.
 *
 * With `wordmark`, "Campus" is the accessible text and the mark is decorative.
 * Without it, the mark is announced as "Campus" unless `decorative`.
 */
export function CampusLogo({
  tone = 'light',
  wordmark = false,
  decorative = false,
  className,
  markClassName,
}: {
  tone?: 'light' | 'dark'
  wordmark?: boolean
  decorative?: boolean
  className?: string
  /** Size of the mark; defaults to 1.5em so it follows the wordmark's font size. */
  markClassName?: string
}) {
  const labelled = !wordmark && !decorative
  return (
    <span className={cn('campus-logo', className)} data-tone={tone}>
      <svg
        viewBox="0 0 64 64"
        className={cn('campus-logo-mark', markClassName)}
        role={labelled ? 'img' : undefined}
        aria-label={labelled ? 'Campus' : undefined}
        aria-hidden={labelled ? undefined : true}
        focusable="false"
      >
        <g transform="translate(0.4 -2)">
          <path
            d="M39.39 16.34 A20 20 0 1 0 48.54 41.49"
            fill="none"
            stroke="currentColor"
            strokeWidth="9"
          />
          <circle cx="50.67" cy="26.48" r="7" className="campus-logo-dot" />
        </g>
      </svg>
      {wordmark ? <span className="campus-logo-word">Campus</span> : null}
    </span>
  )
}
