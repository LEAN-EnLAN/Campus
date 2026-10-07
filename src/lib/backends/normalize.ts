import type { StoredSubjectStatus, UserSubjectState } from '@/domain/types'

import type {
  CreateItemInput,
  CreateResourceInput,
  SaveContextInput,
  SetSubjectStatusInput,
} from './types'

/**
 * The rules both adapters apply, written once.
 *
 * LocalBackend and the Supabase adapter used to each carry their own copy and
 * disagreed: one trimmed titles, the other did not; one cleared a grade, the
 * other could not; only one stamped `completedAt`. Anything that decides what is
 * STORED lives here, so a student who moves between a vault and the cloud is
 * told the same thing about their own data.
 */

const EARNED: ReadonlySet<StoredSubjectStatus> = new Set(['passed', 'equivalent'])

/** `YYYY-MM-DD` in the student's own calendar, not UTC's. */
export function localDateString(now: Date): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

/** Passed and equivalent are completed today; every other status is not completed. */
export function completedAtFor(status: StoredSubjectStatus, now: Date): string | null {
  return EARNED.has(status) ? localDateString(now) : null
}

/**
 * The next stored row for a subject.
 *
 * `grade: undefined` keeps the grade already there; `grade: null` clears it.
 * Notes and `startedAt` are never touched by a status change.
 */
export function nextSubjectState(
  previous: UserSubjectState | undefined,
  input: SetSubjectStatusInput & { status: StoredSubjectStatus },
  now: Date,
): UserSubjectState {
  return {
    curriculumSubjectId: input.curriculumSubjectId,
    status: input.status,
    grade: input.grade === undefined ? (previous?.grade ?? null) : input.grade,
    startedAt: previous?.startedAt ?? null,
    completedAt: completedAtFor(input.status, now),
    notes: previous?.notes ?? null,
  }
}

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function normalizeItemInput(input: CreateItemInput) {
  return {
    title: input.title.trim(),
    kind: input.kind,
    curriculumSubjectId: input.curriculumSubjectId,
    dueAt: input.dueAt,
    notes: blankToNull(input.notes),
  }
}

/** A link keeps only its url, a note only its body — whatever the caller also sent. */
export function normalizeResourceInput(input: CreateResourceInput) {
  return {
    title: input.title.trim(),
    kind: input.kind,
    curriculumSubjectId: input.curriculumSubjectId,
    url: input.kind === 'link' ? blankToNull(input.url) : null,
    body: input.kind === 'note' ? input.body : null,
  }
}

export function normalizeContextInput(input: SaveContextInput): SaveContextInput {
  return { ...input, unmappedLabel: blankToNull(input.unmappedLabel) }
}
