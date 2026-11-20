import { cn } from '@/lib/utils'

import { ILLUSTRATIONS, type IllustrationName } from './illustrations'

const BASE = '/campus-blue-assets'

/**
 * Max rendered width per size, from 390px up. An illustration is a spot, not a
 * banner: one per panel, never next to the primary action's fold.
 *   icon  card headers, menu identity      ~64–80px (1x file only: it is 8x already)
 *   xs  drop zones and dense panels       ~96–112px
 *   sm  cards beside other content        ~176–240px
 *   md  empty states (the default)        ~208–288px
 *   lg  Local/Cloud choice, onboarding    ~240–320px
 */
const SIZE = {
  icon: 'max-w-16 sm:max-w-20',
  xs: 'max-w-24 sm:max-w-28',
  sm: 'max-w-44 sm:max-w-60',
  md: 'max-w-52 sm:max-w-72',
  lg: 'max-w-60 sm:max-w-80',
} as const

/**
 * A registered illustration: raster WebP (transparent, 1x + 2x), or the
 * provisional SVG while the registry still flags the slot `vector`.
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
  fit = 'contain',
  className,
}: {
  name: IllustrationName
  decorative?: boolean
  alt?: string
  size?: keyof typeof SIZE
  /** Above the fold on first paint. Everything else loads lazily. */
  eager?: boolean
  /**
   * `crop` fills a square frame with the drawing's object: the spots share a
   * 16:10 frame with the object centred and empty margin left and right, so a
   * square cover keeps the object and drops the margin (Ajustes' 64px chips).
   * The caller's frame sets the size and clips.
   */
  fit?: 'contain' | 'crop'
  className?: string
}) {
  const entry = ILLUSTRATIONS[name]
  const { width, height, alt: described } = entry
  // Provisional SVGs scale on their own; raster backgrounds (1920 wide) ship
  // one size; raster spots ship 1x and 2x, except at icon size, where the 640px
  // file already covers any screen density and the 2x would be ~70 KB wasted.
  const vector = 'vector' in entry
  const crop = fit === 'crop'
  const hasRetina = !vector && width < 1920 && size !== 'icon' && !crop
  return (
    <img
      src={`${BASE}/${name}.${vector ? 'svg' : 'webp'}`}
      srcSet={hasRetina ? `${BASE}/${name}.webp 1x, ${BASE}/${name}@2x.webp 2x` : undefined}
      alt={decorative ? '' : (alt ?? described)}
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={cn(
        'select-none',
        crop
          ? 'size-full max-w-none object-cover'
          : ['h-auto w-full object-contain', SIZE[size]],
        className,
      )}
    />
  )
}
