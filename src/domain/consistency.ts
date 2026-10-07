import { joinNames } from './requirements'
import type { MissingRequirement, SubjectView } from './types'

/**
 * Allow-and-flag.
 *
 * The student is closer to the truth than our correlativa data: they may hold an
 * equivalencia, a cátedra exception, a different plan version. So a state is
 * never refused and never changed. When it contradicts the plan, we say so once,
 * quietly, and let them dismiss it.
 */

export interface OrderConflict {
  subjectId: string
  /** The unmet requirements that make the state contradictory, with their kind. */
  missing: MissingRequirement[]
  /**
   * Identity of THIS contradiction. A dismissal is stored against it, so fixing
   * one gap and leaving another shows the note again.
   */
  key: string
}

/**
 * Aprobada contradicts any unmet requirement. Regularizada only contradicts an
 * unmet `to_take`: a regularizada subject whose `to_pass` correlativas are still
 * open is the ordinary "Final pendiente" state, not an inconsistency.
 *
 * Equivalencia is the student's way of saying "ignore the plan here", so it is
 * never flagged. Cursando, Desaprobada and unmarked subjects are not either.
 */
export function orderConflictOf(view: SubjectView): OrderConflict | null {
  if (view.status !== 'passed' && view.status !== 'regularized') return null

  const missing =
    view.status === 'passed'
      ? view.missingRequirements
      : view.missingRequirements.filter((m) => m.kind === 'to_take')
  if (missing.length === 0) return null

  const ids = [...new Set(missing.map((m) => m.curriculumSubjectId))]
  return {
    subjectId: view.id,
    missing,
    key: `${view.id}:${view.status}:${ids.join(',')}`,
  }
}

export function listOrderConflicts(views: readonly SubjectView[]): OrderConflict[] {
  const out: OrderConflict[] = []
  for (const view of views) {
    const conflict = orderConflictOf(view)
    if (conflict) out.push(conflict)
  }
  return out
}

export function orderConflictMessage(conflict: OrderConflict): string {
  return `El plan indica que todavía te falta ${describeGap(conflict.missing)}. Si es una equivalencia o excepción, ignorá este aviso.`
}

/** "aprobar A y B", or "aprobar A y B, y cursar C". Aprobar implies cursar, so it wins. */
function describeGap(missing: readonly MissingRequirement[]): string {
  const toPass = distinctNames(missing.filter((m) => m.kind === 'to_pass'))
  const passIds = new Set(toPass.map((m) => m.curriculumSubjectId))
  const toTake = distinctNames(
    missing.filter((m) => m.kind === 'to_take' && !passIds.has(m.curriculumSubjectId)),
  )

  const parts: string[] = []
  if (toPass.length > 0) parts.push(`aprobar ${joinNames(toPass.map((m) => m.name))}`)
  if (toTake.length > 0) parts.push(`cursar ${joinNames(toTake.map((m) => m.name))}`)
  return parts.join(', y ')
}

function distinctNames(items: readonly MissingRequirement[]): MissingRequirement[] {
  return [...new Map(items.map((m) => [m.curriculumSubjectId, m])).values()]
}
