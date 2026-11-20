import { cn } from '@/lib/utils'

import { layoutBubbles, type BubbleSubject } from './bubble-layout'
import { ART_TONES, countByTone, toneSentence, toneTitle } from './tones'

export interface SubjectBubblesProps {
  subjects: readonly BubbleSubject[]
  className?: string
}

/**
 * A crescent on the lower-right inside of a bubble: the illustrations' one soft
 * shade, so each subject reads as a small object rather than a flat dot.
 */
function shadePath(x: number, y: number, r: number): string {
  const at = (deg: number) => {
    const rad = (deg * Math.PI) / 180
    return `${(x + Math.cos(rad) * r).toFixed(2)} ${(y + Math.sin(rad) * r).toFixed(2)}`
  }
  const outer = r.toFixed(2)
  const inner = (r * 1.2).toFixed(2)
  return `M${at(-25)}A${outer} ${outer} 0 0 1 ${at(115)}A${inner} ${inner} 0 0 0 ${at(-25)}Z`
}

/** The carrera as a cluster of subjects, coloured by state, with a counted legend. */
export function SubjectBubbles({ subjects, className }: SubjectBubblesProps) {
  const counts = countByTone(subjects.map((s) => s.status))
  const { bubbles, size } = layoutBubbles(subjects)
  const half = size / 2
  const ring = half - 1.5
  const total = subjects.length
  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      <svg
        role="img"
        aria-label={`${total} ${total === 1 ? 'materia' : 'materias'}: ${toneSentence(counts)}`}
        viewBox={`${-half} ${-half} ${size} ${size}`}
        className="size-36 shrink-0"
      >
        {/* The dotted ring behind the cluster, drawn as a path so the bubbles
            stay the only circles in the drawing. */}
        <path
          className="art-ring"
          d={`M${-ring} 0a${ring} ${ring} 0 1 0 ${ring * 2} 0a${ring} ${ring} 0 1 0 ${-ring * 2} 0`}
        />
        {bubbles.map((bubble, index) => (
          <g
            key={bubble.id}
            className="art-bubble-group"
            style={{ ['--art-i' as string]: Math.min(index, 60) }}
          >
            <circle
              className={`art-bubble art-tone-${bubble.tone}`}
              cx={bubble.x.toFixed(2)}
              cy={bubble.y.toFixed(2)}
              r={bubble.r.toFixed(2)}
            />
            <path className="art-bubble-shade" d={shadePath(bubble.x, bubble.y, bubble.r)} />
          </g>
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
