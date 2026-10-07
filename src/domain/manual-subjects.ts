import type { CurriculumSubject, ManualSubject, Term, UserSubjectState } from './types'

/**
 * Subjects the student types in when their carrera is not in the catalog.
 *
 * They flow through the same resolution as catalog subjects so Materias and Hoy
 * need no second code path, but they are deliberately inert: no correlativas,
 * no `available`, no `blocked`. Campus says only what the student told it.
 */

export const MANUAL_CURRICULUM_ID = 'manual'

export const MANUAL_MAX_YEAR = 10
export const MANUAL_NAME_MAX = 200

const TERMS: readonly Term[] = ['anual', '1c', '2c']

export interface ManualSubjectInput {
  name: string
  yearLevel: number
  term: Term
}

/** The student-facing reason an input cannot be saved, or null when it can. */
export function manualProblem(input: ManualSubjectInput): string | null {
  const name = input.name.trim()
  if (name.length === 0) return 'Escribí el nombre de la materia.'
  if (name.length > MANUAL_NAME_MAX) {
    return `El nombre puede tener hasta ${MANUAL_NAME_MAX} caracteres.`
  }
  if (
    !Number.isInteger(input.yearLevel) ||
    input.yearLevel < 1 ||
    input.yearLevel > MANUAL_MAX_YEAR
  ) {
    return `Elegí un año entre 1 y ${MANUAL_MAX_YEAR}.`
  }
  if (!TERMS.includes(input.term)) return 'Elegí el cuatrimestre: anual, 1° o 2°.'
  return null
}

/** `index` is the position in creation order, so the list never reshuffles. */
export function manualToCurriculumSubject(m: ManualSubject, index: number): CurriculumSubject {
  return {
    id: m.id,
    curriculumId: MANUAL_CURRICULUM_ID,
    subjectId: m.id,
    code: null,
    name: m.name,
    normalizedName: m.name.trim().toLowerCase(),
    yearLevel: m.yearLevel,
    term: m.term,
    credits: null,
    elective: false,
    displayOrder: index + 1,
    manual: true,
  }
}

/** The stored states carried by manual subjects, shaped like catalog ones. */
export function manualStates(subjects: readonly ManualSubject[]): UserSubjectState[] {
  return subjects.flatMap((m) =>
    m.status === null
      ? []
      : [
          {
            curriculumSubjectId: m.id,
            status: m.status,
            grade: m.grade,
            startedAt: null,
            completedAt: null,
            notes: null,
          },
        ],
  )
}
