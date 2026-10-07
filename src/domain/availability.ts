import type {
  CurriculumSubject,
  MissingRequirement,
  PrerequisiteEdge,
  PrerequisiteKind,
  RequirementItem,
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
  /**
   * Does the source publish this plan's correlativas at all? Defaults to true.
   *
   * When false, an empty edge list means "nobody told us", and deriving
   * `available` from it would be Campus asserting that nothing blocks the
   * student — the one claim the plan banner itself refuses to make.
   */
  prerequisitesKnown?: boolean
}

const TERM_SUFFIX: Record<CurriculumSubject['term'], string> = {
  anual: 'anual',
  '1c': '1° cuatr.',
  '2c': '2° cuatr.',
}

/**
 * Display names, unique within the plan.
 *
 * A plan can list the same placeholder twice (UNR has two "Horas electivas",
 * one per cuatrimestre). Two rows with one name are indistinguishable in a
 * select, in search and in the plan, so the duplicates are told apart by term,
 * then by their position in the plan. Unique names are left exactly as the
 * source wrote them.
 */
function displayNames(subjects: readonly CurriculumSubject[]): Map<string, string> {
  const byName = new Map<string, CurriculumSubject[]>()
  for (const s of subjects) {
    const bucket = byName.get(s.name)
    if (bucket) bucket.push(s)
    else byName.set(s.name, [s])
  }

  const names = new Map<string, string>()
  for (const [name, group] of byName) {
    if (group.length === 1) {
      names.set(group[0]!.id, name)
      continue
    }
    const termsDistinguish = new Set(group.map((s) => s.term)).size === group.length
    for (const s of group) {
      names.set(
        s.id,
        termsDistinguish
          ? `${name} (${TERM_SUFFIX[s.term]})`
          : `${name} (${TERM_SUFFIX[s.term]}, n.º ${s.displayOrder})`,
      )
    }
  }
  return names
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
  prerequisitesKnown = true,
}: AvailabilityInput): SubjectView[] {
  const stateById = new Map<string, UserSubjectState>()
  for (const state of states) stateById.set(state.curriculumSubjectId, state)

  const subjectById = new Map<string, CurriculumSubject>()
  for (const subject of subjects) subjectById.set(subject.id, subject)
  const nameOf = displayNames(subjects)

  // Only consider edges whose endpoints both exist in this curriculum. A dangling
  // edge (bad seed, subject from another plan version) must not block a student.
  const requirementsOf = new Map<string, PrerequisiteEdge[]>()
  // A Set, not an array: a real plan declares the same correlativa twice, once as
  // `to_take` and once as `to_pass` (that is how UTN's Ordenanza reads), and an
  // array would list the dependent subject twice in the UI.
  const unlocksOf = new Map<string, Set<string>>()

  for (const edge of prerequisites) {
    if (!subjectById.has(edge.curriculumSubjectId)) continue
    if (!subjectById.has(edge.requiredCurriculumSubjectId)) continue

    const reqs = requirementsOf.get(edge.curriculumSubjectId)
    if (reqs) reqs.push(edge)
    else requirementsOf.set(edge.curriculumSubjectId, [edge])

    // Only `to_take` counts as unlocking. A `to_pass` correlativa never blocked the
    // cursada, so claiming it "habilita" the dependent would be a false causal claim:
    // the student could already take it.
    if (edge.kind === 'to_take') {
      const unlocked = unlocksOf.get(edge.requiredCurriculumSubjectId)
      if (unlocked) unlocked.add(edge.curriculumSubjectId)
      else unlocksOf.set(edge.requiredCurriculumSubjectId, new Set([edge.curriculumSubjectId]))
    }
  }

  const storedStatusOf = (id: string): StoredSubjectStatus | null =>
    stateById.get(id)?.status ?? null

  return subjects.map((subject) => {
    const state = stateById.get(subject.id)
    const stored = state?.status ?? null

    const missing: MissingRequirement[] = []
    const requirements: RequirementItem[] = []
    for (const edge of requirementsOf.get(subject.id) ?? []) {
      const requiredStatus: SubjectStatus =
        storedStatusOf(edge.requiredCurriculumSubjectId) ?? 'pending'
      const met = satisfies(edge.kind, requiredStatus)

      const required = subjectById.get(edge.requiredCurriculumSubjectId)
      // Guarded above, but keep the narrowing explicit rather than asserting.
      if (!required) continue

      const requirement: MissingRequirement = {
        curriculumSubjectId: required.id,
        name: nameOf.get(required.id) ?? required.name,
        kind: edge.kind,
        needs: needsLabel(edge.kind),
      }
      // Advisory edges never block and are never listed as something to do.
      if (edge.kind !== 'recommended') requirements.push({ ...requirement, met })
      if (!met) missing.push(requirement)
    }

    // A `to_take` gap is what actually blocks a cursada. A `to_pass` gap only
    // matters at final time and must not hide the subject from the plan.
    const blockedToTake = subject.manual !== true && missing.some((m) => m.kind === 'to_take')

    // `available` is a claim: "nothing stops you from taking this today". It is
    // only made when we KNOW the plan's correlativas, and never for an elective
    // slot, which is a placeholder for a choice rather than a subject to take.
    // A subject typed in by hand has no correlativas to compute from, so it
    // claims nothing either way.
    const claimsNothing = !prerequisitesKnown || subject.elective || subject.manual === true
    const status: SubjectStatus =
      stored ?? (blockedToTake ? 'blocked' : claimsNothing ? 'pending' : 'available')

    return {
      ...subject,
      name: nameOf.get(subject.id) ?? subject.name,
      status,
      grade: state?.grade ?? null,
      notes: state?.notes ?? null,
      missingRequirements: missing,
      requirements,
      unlocks: [...(unlocksOf.get(subject.id) ?? [])],
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
