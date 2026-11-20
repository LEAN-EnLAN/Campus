import { useId } from 'react'

import { cn } from '@/lib/utils'
import { plural } from '@/lib/text/plural'

/** Where the liquid can reach: from the lid (y=8) to the bottom of the base (y=124). */
const TOP = 8
const BOTTOM = 124

const SILHOUETTE = [
  // Lid
  'M26 12a4 4 0 0 1 4-4h60a4 4 0 0 1 4 4v4H26z',
  // Cup
  'M30 16h60v34c0 20-14 36-30 36S30 70 30 50z',
  // Stem
  'M54 84h12v24H54z',
  // Base
  'M40 108h40a6 6 0 0 1 6 6v10H34v-10a6 6 0 0 1 6-6z',
].join('')

/** One soft lower-right shade per shape: the depth of the flat drawing. */
const SHADE = [
  'M90 16v34c0 20-14 36-30 36c11-6 21-18 21-36V16z',
  'M66 84v24h-5V84z',
  'M80 108a6 6 0 0 1 6 6v10h-8v-10a6 6 0 0 0-3-5z',
].join('')

const HANDLES = 'M30 24H18c-4 0-7 3-7 7 0 13 9 23 22 25M90 24h12c4 0 7 3 7 7 0 13-9 23-22 25'

export interface TrophyFillProps {
  /** Subjects approved (equivalencias included). */
  value: number
  total: number
  className?: string
}

/**
 * A trophy that fills up to the share of the carrera already approved, drawn in
 * the Campus illustration language: navy outline, blue liquid in a pale cup,
 * one soft shade, a dotted ring behind. Animates once on mount; reduced motion
 * shows the final level directly.
 */
export function TrophyFill({ value, total, className }: TrophyFillProps) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0
  const percent = Math.round(ratio * 100)
  const level = (BOTTOM - TOP) * ratio
  const clipId = `trophy-${useId().replace(/[^\w-]/g, '')}`
  return (
    <svg
      role="img"
      aria-label={`${percent}% de la carrera: ${value} de ${total} ${plural(total, 'materia aprobada', 'materias aprobadas')}`}
      viewBox="0 0 120 132"
      className={cn('h-auto w-full max-w-36', className)}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={SILHOUETTE} />
        </clipPath>
      </defs>
      <circle className="art-ring" cx="60" cy="68" r="57" />
      <path className="art-trophy-handle-edge" d={HANDLES} />
      <path className="art-trophy-handle" d={HANDLES} />
      <path className="art-trophy-shape" d={SILHOUETTE} />
      {level > 0 ? (
        <g clipPath={`url(#${clipId})`}>
          <rect
            className="art-trophy-fill"
            x="0"
            y={BOTTOM - level}
            width="120"
            height={level}
          />
        </g>
      ) : null}
      <path className="art-shade" d={SHADE} clipPath={`url(#${clipId})`} />
      <path className="art-outline" d={SILHOUETTE} />
      <path className="art-spark" d="M103 9l5-5M110 20l6-2" />
    </svg>
  )
}
