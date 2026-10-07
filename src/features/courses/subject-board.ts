import { STATUS_GROUPS, statusGroupOf, type StatusGroupId } from '@/domain/status-groups'
import type { StoredSubjectStatus, SubjectStatus, SubjectView } from '@/domain/types'

/**
 * The subject Kanban, as a pure mapping.
 *
 * Four columns, because four are the ones a student can move a subject
 * *into*. Everything else — blocked, pending, desaprobada — is a consequence of
 * the correlativa graph or of a grade, not a place you drag something to.
 *
 * The columns ARE the status groups (`@/domain/status-groups`), so the chips on
 * Materias and the board can never disagree about where a subject lives.
 * Regularizada is "Final pendiente", not Cursando.
 */

export type BoardColumnId = StatusGroupId

/** Board order, left to right. It is the order of the academic year, not of a taste. */
const COLUMN_ORDER: BoardColumnId[] = STATUS_GROUPS.map((g) => g.id)

const COLUMN_NAME: Record<BoardColumnId, string> = Object.fromEntries(
  STATUS_GROUPS.map((g) => [g.id, g.label]),
) as Record<BoardColumnId, string>

/** Which column a subject belongs to, or null when it is off the board. */
export function columnOf(status: SubjectStatus): BoardColumnId | null {
  // `blocked` and `pending` are derived from prerequisites, and `failed` is a
  // result, not a lane. None of them is a drop target.
  return statusGroupOf(status)
}

/**
 * The stored status a drop into this column means.
 *
 * `disponibles` yields `null`, not `'available'`. `available` is DERIVED from
 * the prerequisite graph and is not a `StoredSubjectStatus` at all — the way to
 * put a subject back into "disponible" is to CLEAR the stored state and let
 * availability be recomputed. Returning a status string here would store a
 * claim the graph is entitled to contradict.
 */
export function statusForColumn(column: BoardColumnId): StoredSubjectStatus | null {
  switch (column) {
    case 'disponibles':
      return null
    case 'cursando':
      return 'in_progress'
    case 'final_pendiente':
      return 'regularized'
    case 'aprobadas':
      return 'passed'
  }
}

export interface SubjectBoard {
  columns: { id: BoardColumnId; name: string; subjects: SubjectView[] }[]
  /** Subjects that belong to no column — blocked, pending, failed. Named, never dropped. */
  offBoard: SubjectView[]
}

/**
 * Plan order: the year first, then the curriculum's own sequence, then the name.
 *
 * `localeCompare(…, 'es')` because a codepoint sort files "Álgebra" after
 * "Zoología", which is wrong in every Spanish plan de estudios.
 */
function byPlanOrder(a: SubjectView, b: SubjectView): number {
  if (a.yearLevel !== b.yearLevel) return a.yearLevel - b.yearLevel
  if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder
  return a.name.localeCompare(b.name, 'es')
}

export function buildSubjectBoard(subjects: readonly SubjectView[]): SubjectBoard {
  const buckets = new Map<BoardColumnId, SubjectView[]>(COLUMN_ORDER.map((id) => [id, []]))
  const offBoard: SubjectView[] = []

  for (const subject of subjects) {
    const column = columnOf(subject.status)
    if (column === null) offBoard.push(subject)
    else buckets.get(column)!.push(subject)
  }

  return {
    columns: COLUMN_ORDER.map((id) => ({
      id,
      name: COLUMN_NAME[id],
      subjects: buckets.get(id)!.sort(byPlanOrder),
    })),
    offBoard: offBoard.sort(byPlanOrder),
  }
}
