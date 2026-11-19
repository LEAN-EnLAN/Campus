import type { SubjectStatus } from '@/domain/types'

import { ART_TONES, toneOf, type ArtTone } from './tones'

export interface BubbleSubject {
  id: string
  status: SubjectStatus
  yearLevel: number
  credits: number | null
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const MIN_R = 4.5
const MAX_R = 8

export interface Bubble {
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
