import { cn } from '@/lib/utils'

import { ILLUSTRATIONS, type IllustrationName } from './illustrations'

const BASE = '/campus-blue-assets'

/**
 * Max rendered width per size, from 390px up. An illustration is a spot, not a
 * banner: one per panel, never next to the primary action's fold.
 *   xs  drop zones and dense panels       ~96–112px
 *   sm  cards beside other content        ~176–240px
 *   md  empty states (the default)        ~208–288px
 *   lg  Local/Cloud choice, onboarding    ~240–320px
 */
const SIZE = {
  xs: 'max-w-24 sm:max-w-28',
  sm: 'max-w-44 sm:max-w-60',
  md: 'max-w-52 sm:max-w-72',
  lg: 'max-w-60 sm:max-w-80',
} as const

/**
 * A registered raster illustration (WebP, transparent, 1x + 2x).
 *
 * Accessibility is a decision the caller makes, not a default:
 *   - `decorative`  the heading/text beside it already says it. alt="".
 *   - otherwise     the registry's Spanish description is announced.
 *   - `alt`         override when the surface needs a more specific sentence.
 * It never carries a state, an action or a label: those stay in the HTML.
 */
export function Illustration({
  name,
  decorative = false,
  alt,
  size = 'md',
  eager = false,
  className,
}: {
  name: IllustrationName
  decorative?: boolean
  alt?: string
  size?: keyof typeof SIZE
  /** Above the fold on first paint. Everything else loads lazily. */
  eager?: boolean
  className?: string
}) {
  const { width, height, alt: described } = ILLUSTRATIONS[name]
  // Backgrounds (1920 wide) ship one size; spots ship 1x and 2x.
  const hasRetina = width < 1920
  return (
    <img
      src={`${BASE}/${name}.webp`}
      srcSet={hasRetina ? `${BASE}/${name}.webp 1x, ${BASE}/${name}@2x.webp 2x` : undefined}
      alt={decorative ? '' : (alt ?? described)}
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={cn('h-auto w-full object-contain select-none', SIZE[size], className)}
    />
  )
}
