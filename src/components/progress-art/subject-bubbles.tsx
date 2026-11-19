import type { SubjectStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

import { ART_TONES, countByTone, toneOf, toneSentence, toneTitle, type ArtTone } from './tones'

export interface BubbleSubject {
  id: string
  status: SubjectStatus
  yearLevel: number
  credits: number | null
}

export interface SubjectBubblesProps {
  subjects: readonly BubbleSubject[]
  className?: string
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const MIN_R = 4.5
const MAX_R = 8

interface Bubble {
  id: string
  tone: ArtTone
  x: number
  y: number
  r: number
}

/**
 * One bubble per subject on a sunflower spiral, grouped by state so each colour
 * reads as a patch. Size grows a little with credits when the plan has them,
 * otherwise with the year: a hint, not a measure.
 */
export function layoutBubbles(subjects: readonly BubbleSubject[]): {
  bubbles: Bubble[]
  size: number
} {
  const withCredits = subjects.some((s) => s.credits !== null && s.credits > 0)
  const maxCredits = Math.max(1, ...subjects.map((s) => s.credits ?? 0))
  const maxYear = Math.max(1, ...subjects.map((s) => s.yearLevel))
  const order = new Map(ART_TONES.map((tone, index) => [tone, index]))
  const sorted = [...subjects].sort(
    (a, b) =>
      (order.get(toneOf(a.status)) ?? 0) - (order.get(toneOf(b.status)) ?? 0) ||
      a.yearLevel - b.yearLevel ||
      a.id.localeCompare(b.id),
  )
  const spacing = MAX_R * 1.25
  let extent = MAX_R
  const bubbles = sorted.map((subject, index) => {
    const share = withCredits
      ? (subject.credits ?? 0) / maxCredits
      : (subject.yearLevel - 1) / Math.max(1, maxYear - 1)
    const r = MIN_R + (MAX_R - MIN_R) * Math.min(1, Math.max(0, share))
    const distance = spacing * Math.sqrt(index + 0.5)
    const angle = index * GOLDEN_ANGLE
    const x = Math.cos(angle) * distance
    const y = Math.sin(angle) * distance
    extent = Math.max(extent, Math.abs(x) + r, Math.abs(y) + r)
    return { id: subject.id, tone: toneOf(subject.status), x, y, r }
  })
  return { bubbles, size: Math.ceil(extent * 2 + 4) }
}

/** The carrera as a cluster of subjects, coloured by state, with a counted legend. */
export function SubjectBubbles({ subjects, className }: SubjectBubblesProps) {
  const counts = countByTone(subjects.map((s) => s.status))
  const { bubbles, size } = layoutBubbles(subjects)
  const half = size / 2
  const total = subjects.length
  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      <svg
        role="img"
        aria-label={`${total} ${total === 1 ? 'materia' : 'materias'}: ${toneSentence(counts)}`}
        viewBox={`${-half} ${-half} ${size} ${size}`}
        className="size-36 shrink-0"
      >
        {bubbles.map((bubble, index) => (
          <circle
            key={bubble.id}
            className={`art-bubble art-tone-${bubble.tone}`}
            style={{ ['--art-i' as string]: Math.min(index, 60) }}
            cx={bubble.x.toFixed(2)}
            cy={bubble.y.toFixed(2)}
            r={bubble.r.toFixed(2)}
          />
        ))}
      </svg>
      <ul className="grid min-w-0 flex-1 gap-1.5 text-sm" aria-hidden="true">
        {ART_TONES.map((tone) => (
          <li key={tone} className="flex items-center gap-2">
            <span className={`art-legend-dot art-tone-${tone}`} />
            <span className="text-ink-muted min-w-0 flex-1 truncate">{toneTitle(tone)}</span>
            <strong className="text-ink tabular-nums">{counts[tone]}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
