import { cn } from '@/lib/utils'

import { layoutBubbles, type BubbleSubject } from './bubble-layout'
import { ART_TONES, countByTone, toneSentence, toneTitle } from './tones'

export interface SubjectBubblesProps {
  subjects: readonly BubbleSubject[]
  className?: string
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
