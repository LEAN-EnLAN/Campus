import type { MissingRequirement, RequirementItem, SubjectView } from './types'

/**
 * Cursar vs rendir el final, stated from the same computation that already
 * decides availability. Nothing here recomputes it: these are read-only views
 * over `SubjectView.requirements` / `missingRequirements`.
 */

/** "A", "A y B", "A, B y C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

/** One entry per subject, first occurrence wins, order kept. */
function distinctById<T extends { curriculumSubjectId: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    if (seen.has(item.curriculumSubjectId)) continue
    seen.add(item.curriculumSubjectId)
    out.push(item)
  }
  return out
}

export interface RequirementGroups {
  /** `to_take`: what you need before you can sit in the class. */
  cursar: RequirementItem[]
  /** `to_pass`: what you need approved before you can sit the final. */
  rendir: RequirementItem[]
}

/** The two panels of "Correlativas". No subject appears twice in one group. */
export function requirementGroups(view: SubjectView): RequirementGroups {
  return {
    cursar: distinctById(view.requirements.filter((r) => r.kind === 'to_take')),
    rendir: distinctById(view.requirements.filter((r) => r.kind === 'to_pass')),
  }
}

/** Unmet `to_pass` requirements, one per subject. */
export function finalBlockers(view: SubjectView): RequirementItem[] {
  return requirementGroups(view).rendir.filter((r) => !r.met)
}

/**
 * The student can take the subject (or is taking it) but cannot sit its final yet.
 *
 * Not true for `blocked` — that subject cannot be taken at all, so "final
 * bloqueado" would bury the real blocker — nor for one already approved.
 */
export function isFinalBlocked(view: SubjectView): boolean {
  if (
    view.status !== 'available' &&
    view.status !== 'in_progress' &&
    view.status !== 'regularized'
  ) {
    return false
  }
  return finalBlockers(view).length > 0
}

export function finalBlockedSentence(view: SubjectView): string | null {
  if (!isFinalBlocked(view)) return null
  const names = finalBlockers(view).map((r) => r.name)
  return `Todavía no podés rendir el final: te falta aprobar ${joinNames(names)}.`
}

/** Missing requirements as DISTINCT subjects — "faltan 2", never "+43" lines. */
export function distinctMissing(view: SubjectView): MissingRequirement[] {
  return distinctById(view.missingRequirements)
}

/** "falta Álgebra" / "faltan 2" — subjects, not requirement lines. Null when nothing is missing. */
export function missingSummary(view: SubjectView): string | null {
  const missing = distinctMissing(view)
  if (missing.length === 0) return null
  return missing.length === 1 ? `falta ${missing[0]!.name}` : `faltan ${missing.length}`
}
