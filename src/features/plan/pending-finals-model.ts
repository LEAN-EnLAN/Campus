import { pendingFinals, type PendingFinal } from '@/domain/pending-finals'
import type { AcademicItem, SubjectView } from '@/domain/types'
import { anchorOf } from '@/features/items/due'
import { finalNoteSentence, finalPrerequisiteNote } from '@/features/items/final-check'

/** The section's anchor: Hoy links to `/plan#finales-pendientes`. */
export const PENDING_FINALS_ID = 'finales-pendientes'

/**
 * One row of "Finales pendientes": the domain ordering plus what the student
 * already booked and the one soft correlativas note from `final-check.ts`.
 */
export interface PendingFinalRow extends PendingFinal {
  /** The next final booked for this subject, if any. */
  scheduled: AcademicItem | null
  /** Non-blocking: why sitting this final now (or on its date) breaks correlativas. */
  warning: string | null
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** The earliest open final for `subjectId` dated today or later. Past ones are history. */
export function nextScheduledFinal(
  subjectId: string,
  items: readonly AcademicItem[],
  now: Date,
): AcademicItem | null {
  const today = startOfDay(now)
  let next: { item: AcademicItem; at: number } | null = null
  for (const item of items) {
    if (item.kind !== 'final' || item.status !== 'open') continue
    if (item.curriculumSubjectId !== subjectId) continue
    const raw = anchorOf(item)
    const at = raw ? new Date(raw).getTime() : Number.NaN
    if (Number.isNaN(at) || at < today) continue
    if (!next || at < next.at) next = { item, at }
  }
  return next?.item ?? null
}

export function pendingFinalRows(
  views: readonly SubjectView[],
  items: readonly AcademicItem[],
  now: Date,
): PendingFinalRow[] {
  return pendingFinals(views).map((entry) => {
    const scheduled = nextScheduledFinal(entry.subject.id, items, now)
    const note = finalPrerequisiteNote(
      {
        kind: 'final',
        curriculumSubjectId: entry.subject.id,
        // Checked against its booked date, or against today when there is none.
        dueAt: scheduled ? anchorOf(scheduled) : now.toISOString(),
        startsAt: null,
      },
      views,
      items,
    )
    return { ...entry, scheduled, warning: note ? finalNoteSentence(note) : null }
  })
}
