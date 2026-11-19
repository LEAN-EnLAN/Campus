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

export interface TrophyFillProps {
  /** Subjects approved (equivalencias included). */
  value: number
  total: number
  className?: string
}

/**
 * A trophy that fills up to the share of the carrera already approved.
 * Animates once on mount; reduced motion shows the final level directly.
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
      <path
        className="art-trophy-handle"
        strokeWidth="7"
        strokeLinecap="round"
        d="M30 24H18c-4 0-7 3-7 7 0 13 9 23 22 25M90 24h12c4 0 7 3 7 7 0 13-9 23-22 25"
      />
      <path className="art-trophy-shape" d={SILHOUETTE} />
      {level > 0 ? (
        <rect
          className="art-trophy-fill"
          clipPath={`url(#${clipId})`}
          x="0"
          y={BOTTOM - level}
          width="120"
          height={level}
        />
      ) : null}
    </svg>
  )
}
