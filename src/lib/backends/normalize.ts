import { manualProblem } from '@/domain/manual-subjects'
import type { StoredSubjectStatus, UserSubjectState } from '@/domain/types'

import {
  backendError,
  type AddManualSubjectInput,
  type CreateItemInput,
  type CreateResourceInput,
  type SaveContextInput,
  type SetSubjectStatusInput,
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

/** Trims the name and refuses what cannot be stored, in a sentence the student can act on. */
export function normalizeManualSubjectInput(
  input: AddManualSubjectInput,
): AddManualSubjectInput {
  const problem = manualProblem(input)
  if (problem) backendError('No pudimos guardar la materia', problem)
  return { name: input.name.trim(), yearLevel: input.yearLevel, term: input.term }
}

/**
 * A manual subject's next status and grade. Same rule as a catalog row:
 * `grade: undefined` keeps the grade, `grade: null` clears it.
 */
export function nextManualStatus(
  previous: { grade: number | null },
  input: SetSubjectStatusInput,
): { status: StoredSubjectStatus | null; grade: number | null } {
  return {
    status: input.status,
    grade: input.grade === undefined ? previous.grade : input.grade,
  }
}

/** A bulk write is one file or one table, never both. */
export function assertUniformBatch(inputs: readonly SetSubjectStatusInput[]): boolean {
  const manual = inputs.filter((i) => i.manual === true).length
  if (manual !== 0 && manual !== inputs.length) {
    backendError(
      'No pudimos guardar tu avance',
      'no se pueden mezclar materias del plan y materias cargadas a mano en una misma carga',
    )
  }
  return manual > 0
}
