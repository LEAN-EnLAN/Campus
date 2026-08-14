import type {
  CurriculumSubject,
  MissingRequirement,
  PrerequisiteEdge,
  PrerequisiteKind,
  StoredSubjectStatus,
  SubjectStatus,
  SubjectView,
  UserSubjectState,
  YearGroup,
} from './types'

/**
 * CAP-PLAN-002 — availability lives here, in the domain, never in React.
 *
 * A subject the student has not explicitly touched is either:
 *   - `available` — every `to_take` correlativa is satisfied, or
 *   - `blocked`   — at least one is not.
 *
 * A subject the student HAS touched keeps its stored status. We do not silently
 * downgrade a subject the student says they are cursando just because our
 * correlativa data disagrees: the student is closer to the truth than our seed,
 * and P-05 cuts both ways. We surface the conflict instead (`missingRequirements`
 * is still populated), we do not overwrite it.
 */

/** Statuses that satisfy a `to_take` (para cursar) correlativa. */
const SATISFIES_TO_TAKE: ReadonlySet<SubjectStatus> = new Set<SubjectStatus>([
  'regularized',
  'passed',
  'equivalent',
])

/** Statuses that satisfy a `to_pass` (para rendir) correlativa. */
const SATISFIES_TO_PASS: ReadonlySet<SubjectStatus> = new Set<SubjectStatus>([
  'passed',
  'equivalent',
])

function satisfies(kind: PrerequisiteKind, status: SubjectStatus): boolean {
  switch (kind) {
    case 'to_take':
      return SATISFIES_TO_TAKE.has(status)
    case 'to_pass':
      return SATISFIES_TO_PASS.has(status)
    case 'recommended':
      // Advisory only — never blocks.
      return true
  }
}

function needsLabel(kind: PrerequisiteKind): MissingRequirement['needs'] {
  return kind === 'to_pass' ? 'aprobar' : 'cursar'
}

export interface AvailabilityInput {
  subjects: readonly CurriculumSubject[]
  prerequisites: readonly PrerequisiteEdge[]
  states: readonly UserSubjectState[]
}

/**
 * Resolve every curriculum subject against the student's stored state and the
 * prerequisite graph.
 *
 * Pure and deterministic: same input, same output. Input order is preserved
 * within a year via `displayOrder`.
 */
export function computeSubjectViews({
  subjects,
  prerequisites,
  states,
}: AvailabilityInput): SubjectView[] {
  const stateById = new Map<string, UserSubjectState>()
  for (const state of states) stateById.set(state.curriculumSubjectId, state)

  const subjectById = new Map<string, CurriculumSubject>()
  for (const subject of subjects) subjectById.set(subject.id, subject)

  // Only consider edges whose endpoints both exist in this curriculum. A dangling
  // edge (bad seed, subject from another plan version) must not block a student.
  const requirementsOf = new Map<string, PrerequisiteEdge[]>()
  const unlocksOf = new Map<string, string[]>()

  for (const edge of prerequisites) {
    if (!subjectById.has(edge.curriculumSubjectId)) continue
    if (!subjectById.has(edge.requiredCurriculumSubjectId)) continue

    const reqs = requirementsOf.get(edge.curriculumSubjectId)
    if (reqs) reqs.push(edge)
    else requirementsOf.set(edge.curriculumSubjectId, [edge])

    if (edge.kind !== 'recommended') {
      const unlocked = unlocksOf.get(edge.requiredCurriculumSubjectId)
      if (unlocked) unlocked.push(edge.curriculumSubjectId)
      else unlocksOf.set(edge.requiredCurriculumSubjectId, [edge.curriculumSubjectId])
    }
  }

  const storedStatusOf = (id: string): StoredSubjectStatus | null =>
    stateById.get(id)?.status ?? null

  return subjects.map((subject) => {
    const state = stateById.get(subject.id)
    const stored = state?.status ?? null

    const missing: MissingRequirement[] = []
    for (const edge of requirementsOf.get(subject.id) ?? []) {
      const requiredStatus: SubjectStatus =
        storedStatusOf(edge.requiredCurriculumSubjectId) ?? 'pending'
      if (satisfies(edge.kind, requiredStatus)) continue

      const required = subjectById.get(edge.requiredCurriculumSubjectId)
      // Guarded above, but keep the narrowing explicit rather than asserting.
      if (!required) continue

      missing.push({
        curriculumSubjectId: required.id,
        name: required.name,
        kind: edge.kind,
        needs: needsLabel(edge.kind),
      })
    }

    // A `to_take` gap is what actually blocks a cursada. A `to_pass` gap only
    // matters at final time and must not hide the subject from the plan.
    const blockedToTake = missing.some((m) => m.kind === 'to_take')

    const status: SubjectStatus = stored ?? (blockedToTake ? 'blocked' : 'available')

    return {
      ...subject,
      status,
      grade: state?.grade ?? null,
      notes: state?.notes ?? null,
      missingRequirements: missing,
      unlocks: unlocksOf.get(subject.id) ?? [],
    }
  })
}

/** Group resolved subjects by year level, ordered by `displayOrder` then name. */
export function groupByYear(views: readonly SubjectView[]): YearGroup[] {
  const byYear = new Map<number, SubjectView[]>()

  for (const view of views) {
    const bucket = byYear.get(view.yearLevel)
    if (bucket) bucket.push(view)
    else byYear.set(view.yearLevel, [view])
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([yearLevel, subjects]) => ({
      yearLevel,
      subjects: [...subjects].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'es'),
      ),
    }))
}

/**
 * Subjects that became newly available because `changedId` reached `newStatus`.
 * Used to tell the student what a `passed` actually unlocked.
 */
export function newlyUnlocked(
  before: readonly SubjectView[],
  after: readonly SubjectView[],
): SubjectView[] {
  const wasBlocked = new Set(before.filter((v) => v.status === 'blocked').map((v) => v.id))
  return after.filter((v) => v.status === 'available' && wasBlocked.has(v.id))
}
