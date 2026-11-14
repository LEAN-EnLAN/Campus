import { computeSubjectViews, newlyUnlocked, type AvailabilityInput } from './availability'
import { comparePlanOrder } from './pending-finals'
import { isFinalBlocked } from './requirements'
import type { StoredSubjectStatus, SubjectView, Term, UserSubjectState } from './types'

/**
 * "¿Qué curso el cuatri que viene?" — the plan under statuses the student only
 * imagines. Pure: the hypotheses live in memory, the real states are never
 * touched, and availability comes from the same `computeSubjectViews` the real
 * plan uses, so the simulation cannot disagree with the plan about a rule.
 */

/** Subject id → the status the student imagines. `null` means "Sin marcar". */
export type Hypotheses = ReadonlyMap<string, StoredSubjectStatus | null>

/** The real states with the hypotheses laid on top. The input array is not modified. */
export function applyHypotheses(
  states: readonly UserSubjectState[],
  hypotheses: Hypotheses,
): UserSubjectState[] {
  const out = states
    .filter((s) => !hypotheses.has(s.curriculumSubjectId))
    .map((s) => ({ ...s }))
  for (const [curriculumSubjectId, status] of hypotheses) {
    if (status === null) continue
    const real = states.find((s) => s.curriculumSubjectId === curriculumSubjectId)
    out.push({
      curriculumSubjectId,
      status,
      grade: real?.grade ?? null,
      startedAt: real?.startedAt ?? null,
      completedAt: real?.completedAt ?? null,
      notes: real?.notes ?? null,
    })
  }
  return out
}

export function simulateViews(input: AvailabilityInput, hypotheses: Hypotheses): SubjectView[] {
  return computeSubjectViews({ ...input, states: applyHypotheses(input.states, hypotheses) })
}

export interface SimulationDiff {
  /** Blocked for cursar today, available under the hypotheses. */
  cursar: SubjectView[]
  /** Cursando or regularizada, final blocked today, rendible under the hypotheses. */
  rendir: SubjectView[]
  /** Available today, blocked under the hypotheses (a status taken back). */
  closes: SubjectView[]
}

/** What the hypotheses change, against the real plan. Plan order within each list. */
export function simulationDiff(
  real: readonly SubjectView[],
  simulated: readonly SubjectView[],
): SimulationDiff {
  const realById = new Map(real.map((v) => [v.id, v]))
  const rendir = simulated.filter((after) => {
    const before = realById.get(after.id)
    // Only a subject the student is cursando or has regularizado has a final to
    // sit; one they imagine approved, or have not started, is not "se te abre".
    if (after.status !== 'in_progress' && after.status !== 'regularized') return false
    return before !== undefined && isFinalBlocked(before) && !isFinalBlocked(after)
  })
  return {
    cursar: newlyUnlocked(real, simulated).sort(comparePlanOrder),
    rendir: rendir.sort(comparePlanOrder),
    closes: newlyUnlocked(simulated, real)
      .map((v) => simulated.find((s) => s.id === v.id) ?? v)
      .sort(comparePlanOrder),
  }
}

export type TermFilter = Term | 'all'

export function filterByTerm<T extends Pick<SubjectView, 'term'>>(
  views: readonly T[],
  term: TermFilter,
): T[] {
  return term === 'all' ? [...views] : views.filter((v) => v.term === term)
}

/** The terms that actually occur in a plan, in calendar order. */
export function termsInPlan(views: readonly Pick<SubjectView, 'term'>[]): Term[] {
  const present = new Set(views.map((v) => v.term))
  return (['1c', '2c', 'anual'] as const).filter((t) => present.has(t))
}

/** How a term reads in a filter or a list. */
export const TERM_LABEL: Record<Term, string> = {
  '1c': '1° cuatr.',
  '2c': '2° cuatr.',
  anual: 'Anual',
}
