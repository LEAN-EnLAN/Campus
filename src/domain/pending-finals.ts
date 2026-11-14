import { joinNames } from './requirements'
import type { SubjectView } from './types'

/**
 * "Finales pendientes": which regularizada to sit first.
 *
 * What passing a final changes, in this model, is the `to_pass` side of the
 * graph. A regularizada already satisfies every `to_take` (para cursar)
 * correlativa that points at it, so `SubjectView.unlocks` (the `to_take`
 * dependents) is already open and counting it here would credit the final with
 * something the cursada did. The subjects a final really habilita are the ones
 * whose OWN final the plan says needs it aprobada.
 *
 * Read-only over `SubjectView.requirements`, which the domain already resolved
 * from the official correlativas. Nothing is inferred: a plan with no published
 * correlativas yields zero dependents for every subject, and the screen has to
 * say "unknown" rather than "habilita 0".
 */

export interface FinalDependent {
  subject: SubjectView
  /** Other subjects this one's final still waits on, besides the final in question. */
  alsoNeeds: string[]
}

export interface PendingFinal {
  subject: SubjectView
  /** Subjects whose final asks for this one aprobada, in plan order. */
  opens: FinalDependent[]
}

/** Year, then the plan's own order, then name. The order the plan is read in. */
export function comparePlanOrder(a: SubjectView, b: SubjectView): number {
  return (
    a.yearLevel - b.yearLevel ||
    a.displayOrder - b.displayOrder ||
    a.name.localeCompare(b.name, 'es')
  )
}

const DONE: ReadonlySet<SubjectView['status']> = new Set(['passed', 'equivalent'])

/** Subjects whose final needs `subjectId` aprobada, skipping ones already approved. */
export function finalDependents(
  subjectId: string,
  views: readonly SubjectView[],
): FinalDependent[] {
  const dependents: FinalDependent[] = []
  for (const view of views) {
    if (view.id === subjectId || DONE.has(view.status)) continue
    const rendir = view.requirements.filter((r) => r.kind === 'to_pass')
    if (!rendir.some((r) => r.curriculumSubjectId === subjectId)) continue
    const alsoNeeds = new Map<string, string>()
    for (const r of rendir) {
      if (!r.met && r.curriculumSubjectId !== subjectId)
        alsoNeeds.set(r.curriculumSubjectId, r.name)
    }
    dependents.push({ subject: view, alsoNeeds: [...alsoNeeds.values()] })
  }
  return dependents.sort((a, b) => comparePlanOrder(a.subject, b.subject))
}

/**
 * Every regularizada, the one whose final habilita the most subjects first.
 * Ties keep plan order, so earlier subjects come before later ones.
 */
export function pendingFinals(views: readonly SubjectView[]): PendingFinal[] {
  return views
    .filter((view) => view.status === 'regularized')
    .map((subject) => ({ subject, opens: finalDependents(subject.id, views) }))
    .sort((a, b) => b.opens.length - a.opens.length || comparePlanOrder(a.subject, b.subject))
}

/**
 * "Habilita el final de 3 materias" / "… de 1 materia". It names the FINAL on
 * purpose: "Habilita 3 materias" read as three subjects you could start taking,
 * while the simulator (which lists newly cursables) showed none opening.
 */
export function opensLabel(count: number): string {
  return `Habilita el final de ${count} ${count === 1 ? 'materia' : 'materias'}`
}

/** One dependent as a line: its name, and what else its final waits on. */
export function dependentLine(dependent: FinalDependent): string {
  if (dependent.alsoNeeds.length === 0) return dependent.subject.name
  return `${dependent.subject.name} (también pide ${joinNames(dependent.alsoNeeds)})`
}
