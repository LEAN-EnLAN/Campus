import type { SubjectStatus } from '@/domain/types'
import { plural } from '@/lib/text/plural'

/** The four states the progress illustrations draw, in the order a carrera moves. */
export type ArtTone = 'approved' | 'regular' | 'cursando' | 'pending'

export const ART_TONES: readonly ArtTone[] = ['approved', 'regular', 'cursando', 'pending']

/** Equivalencias count as approved; anything not yet started or failed is still to do. */
export function toneOf(status: SubjectStatus): ArtTone {
  switch (status) {
    case 'passed':
    case 'equivalent':
      return 'approved'
    case 'regularized':
      return 'regular'
    case 'in_progress':
      return 'cursando'
    default:
      return 'pending'
  }
}

const WORDS: Record<ArtTone, readonly [string, string]> = {
  approved: ['aprobada', 'aprobadas'],
  regular: ['regularizada', 'regularizadas'],
  cursando: ['cursando', 'cursando'],
  pending: ['por cursar', 'por cursar'],
}

/** "aprobada" / "aprobadas", agreeing with the count. */
export function toneWord(tone: ArtTone, count: number): string {
  const [one, many] = WORDS[tone]
  return plural(count, one, many)
}

/** "Aprobadas", for a legend heading that does not carry a count. */
export function toneTitle(tone: ArtTone): string {
  const word = WORDS[tone][1]
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function countByTone(statuses: readonly SubjectStatus[]): Record<ArtTone, number> {
  const counts: Record<ArtTone, number> = { approved: 0, regular: 0, cursando: 0, pending: 0 }
  for (const status of statuses) counts[toneOf(status)] += 1
  return counts
}

/** "3 aprobadas, 1 regularizada, 2 cursando y 10 por cursar": the sentence an aria-label reads. */
export function toneSentence(counts: Record<ArtTone, number>): string {
  const parts = ART_TONES.filter((tone) => counts[tone] > 0).map(
    (tone) => `${counts[tone]} ${toneWord(tone, counts[tone])}`,
  )
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}
