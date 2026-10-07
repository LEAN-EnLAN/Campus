import type { StoredSubjectStatus, SubjectStatus, SubjectView } from './types'

/**
 * "Cargar mi avance": the vocabulary and the one bulk operation of entering a
 * student's history in one sitting.
 *
 * Allow-and-flag: nothing here validates against correlativas. The student is
 * closer to the truth than the plan; `consistency.ts` reports the contradictions
 * afterwards, once.
 */

export interface EntryOption {
  /** `null` clears the stored status. */
  value: StoredSubjectStatus | null
  label: string
  /** One line for people who do not know what the label means. */
  hint: string
}

/** Left to right, the way an academic year goes. */
export const ENTRY_OPTIONS: readonly EntryOption[] = [
  { value: null, label: 'Sin marcar', hint: 'Todavía no la cursaste' },
  { value: 'in_progress', label: 'Cursando', hint: 'La estás cursando ahora' },
  {
    value: 'regularized',
    label: 'Regularizada',
    hint: 'Cursada aprobada, falta rendir el final',
  },
  { value: 'passed', label: 'Aprobada', hint: 'Final aprobado' },
  { value: 'equivalent', label: 'Equivalencia', hint: 'Te la reconocieron por otra materia' },
]

/**
 * The control's value for a derived status. `available`, `blocked` and `pending`
 * are not stored, so they all read as "Sin marcar"; `failed` is stored but has
 * no option here and is passed through so the control can still show it.
 */
export function entryValueOf(status: SubjectStatus): StoredSubjectStatus | null {
  switch (status) {
    case 'in_progress':
    case 'regularized':
    case 'passed':
    case 'failed':
    case 'equivalent':
      return status
    case 'available':
    case 'blocked':
    case 'pending':
      return null
  }
}

export interface StatusChange {
  subjectId: string
  from: StoredSubjectStatus | null
  to: StoredSubjectStatus | null
}

/**
 * "Aprobé todo N° año".
 *
 * Skips electives (a slot is not a subject the student passed) and anything
 * already earned, so an Equivalencia is never downgraded to Aprobada. Returns
 * what each subject was, which is what makes "Deshacer" possible.
 */
export function approveYear(views: readonly SubjectView[], yearLevel: number): StatusChange[] {
  const changes: StatusChange[] = []
  for (const view of views) {
    if (view.yearLevel !== yearLevel || view.elective) continue
    if (view.status === 'passed' || view.status === 'equivalent') continue
    changes.push({ subjectId: view.id, from: entryValueOf(view.status), to: 'passed' })
  }
  return changes
}

/** The writes that put every changed subject back as it was. */
export function revertChanges(
  changes: readonly StatusChange[],
): { subjectId: string; status: StoredSubjectStatus | null }[] {
  return changes.map((c) => ({ subjectId: c.subjectId, status: c.from }))
}
