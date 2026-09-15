import type { StoredSubjectStatus, SubjectStatus, SubjectView } from '@/domain/types'

/**
 * The subject Kanban, as a pure mapping.
 *
 * Three columns, because three are the ones a student can move a subject
 * *into*. Everything else — blocked, pending, desaprobada — is a consequence of
 * the correlativa graph or of a grade, not a place you drag something to.
 */

export type BoardColumnId = 'disponibles' | 'cursando' | 'aprobadas'

/** Board order, left to right. It is the order of the academic year, not of a taste. */
const COLUMN_ORDER: BoardColumnId[] = ['disponibles', 'cursando', 'aprobadas']

const COLUMN_NAME: Record<BoardColumnId, string> = {
  disponibles: 'Disponibles',
  cursando: 'Cursando',
  aprobadas: 'Aprobadas',
}

/** Which column a subject belongs to, or null when it is off the board. */
export function columnOf(status: SubjectStatus): BoardColumnId | null {
  switch (status) {
    case 'available':
      return 'disponibles'
    case 'in_progress':
    case 'regularized':
      return 'cursando'
    case 'passed':
    case 'equivalent':
      return 'aprobadas'
    // `blocked` and `pending` are derived from prerequisites, and `failed` is a
    // result, not a lane. None of them is a drop target.
    case 'blocked':
    case 'pending':
    case 'failed':
      return null
  }
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
