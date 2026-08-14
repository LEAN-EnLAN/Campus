/**
 * Campus domain types.
 *
 * These are hand-written and deliberately NOT the database row types. `src/lib/db`
 * maps rows onto these so screens never depend on column names.
 *
 * This module — and everything else in `src/domain` — must stay pure: no React,
 * no Supabase, no I/O. See the campus-frontend skill.
 */

// --- Academic reference data -------------------------------------------------

export type AcademicUnitKind =
  'faculty' | 'regional_faculty' | 'school' | 'department' | 'institute'

export type Term = 'anual' | '1c' | '2c'

export interface Institution {
  id: string
  slug: string
  name: string
  shortName: string
  country: string
}

export interface AcademicUnit {
  id: string
  institutionId: string
  parentId: string | null
  kind: AcademicUnitKind
  name: string
  slug: string
}

export interface Program {
  id: string
  academicUnitId: string
  name: string
  degreeType: string
  durationHint: string | null
}

export interface Curriculum {
  id: string
  programId: string
  name: string
  version: string
  sourceUrl: string | null
  sourceKind: 'html' | 'pdf' | 'manual' | null
  sourceFetchedAt: string | null
}

/** A subject as it appears *inside a specific curriculum*. */
export interface CurriculumSubject {
  id: string
  curriculumId: string
  subjectId: string
  code: string | null
  name: string
  normalizedName: string
  yearLevel: number
  term: Term
  credits: number | null
  elective: boolean
  displayOrder: number
}

export type PrerequisiteKind = 'to_take' | 'to_pass' | 'recommended'

/**
 * A prerequisite edge between two curriculum subjects.
 * `subjectId` requires `requiredSubjectId`.
 */
export interface PrerequisiteEdge {
  curriculumSubjectId: string
  requiredCurriculumSubjectId: string
  kind: PrerequisiteKind
}

// --- User state --------------------------------------------------------------

/**
 * Statuses a student can explicitly hold for a subject.
 *
 * `available` and `pending` are NOT stored — they are derived by
 * `computeAvailability`. Storing them would let the database drift out of sync
 * with the prerequisite graph.
 */
export type StoredSubjectStatus =
  'in_progress' | 'regularized' | 'passed' | 'failed' | 'equivalent'

/** Stored statuses plus the two derived ones, plus `blocked`. */
export type SubjectStatus = StoredSubjectStatus | 'pending' | 'available' | 'blocked'

export interface UserSubjectState {
  curriculumSubjectId: string
  status: StoredSubjectStatus
  grade: number | null
  startedAt: string | null
  completedAt: string | null
  notes: string | null
}

export type AcademicItemKind =
  'task' | 'assignment' | 'midterm' | 'final' | 'registration' | 'class' | 'custom'

export type AcademicItemStatus = 'open' | 'done' | 'cancelled'

export interface AcademicItem {
  id: string
  curriculumSubjectId: string | null
  kind: AcademicItemKind
  title: string
  startsAt: string | null
  dueAt: string | null
  status: AcademicItemStatus
  notes: string | null
}

export type ResourceKind = 'link' | 'note' | 'file'

export interface Resource {
  id: string
  curriculumSubjectId: string | null
  kind: ResourceKind
  title: string
  url: string | null
  storagePath: string | null
  body: string | null
  createdAt: string
}

export interface AcademicContext {
  id: string
  institutionId: string | null
  academicUnitId: string | null
  programId: string | null
  curriculumId: string | null
  /** Set when the student's plan is not in Campus yet (CAP-ONBOARD-002). */
  unmappedLabel: string | null
  isActive: boolean
}

// --- Derived views -----------------------------------------------------------

/** A curriculum subject resolved against the student's own state. */
export interface SubjectView extends CurriculumSubject {
  status: SubjectStatus
  grade: number | null
  notes: string | null
  /** Prerequisites that are not yet satisfied. Empty unless status is `blocked`. */
  missingRequirements: MissingRequirement[]
  /** Curriculum subject ids this one unlocks. */
  unlocks: string[]
}

export interface MissingRequirement {
  curriculumSubjectId: string
  name: string
  kind: PrerequisiteKind
  /** What the student still has to reach. */
  needs: 'cursar' | 'aprobar'
}

export interface YearGroup {
  yearLevel: number
  subjects: SubjectView[]
}

export interface ProgressSummary {
  total: number
  passed: number
  inProgress: number
  regularized: number
  available: number
  blocked: number
  pending: number
  failed: number
  equivalent: number
  /** Passed + equivalent over total, 0–1. */
  ratio: number
  creditsEarned: number | null
  creditsTotal: number | null
}
