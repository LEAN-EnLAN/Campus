import type {
  AcademicContext,
  AcademicItem,
  AcademicItemKind,
  AcademicUnit,
  Curriculum,
  CurriculumSubject,
  Institution,
  PrerequisiteEdge,
  Program,
  Resource,
  ResourceKind,
  StoredSubjectStatus,
  UserSubjectState,
} from '@/domain/types'

/**
 * The one seam between the app and wherever its data actually lives.
 *
 * See `docs/adr/ADR-local-first-backend.md`. The shape is deliberately not a
 * generic repository: it is exactly the sixteen use cases the sixteen existing
 * hooks already had, so there is nothing to misuse and nothing dead to maintain.
 * A method with no caller does not get written.
 *
 * Implementations must be behaviourally equivalent — same inputs, same domain
 * types out, same errors in Spanish. That equivalence is what
 * `tests/backends/conformance` exists to hold.
 */
export interface CampusBackend {
  /** Which runtime this backend serves. Diagnostics only — never branch UI on it. */
  readonly kind: 'local' | 'cloud'

  /**
   * Curated academic reference data: institutions through curricula.
   * Read-only in every mode; the student never authors it.
   */
  catalog: {
    institutions(): Promise<Institution[]>
    academicUnits(institutionId: string): Promise<AcademicUnit[]>
    programs(academicUnitId: string): Promise<Program[]>
    curricula(programId: string): Promise<Curriculum[]>
    curriculumBundle(curriculumId: string): Promise<CurriculumBundle>
  }

  /** The student's own academic state. */
  academic: {
    context(): Promise<AcademicContext | null>
    saveContext(input: SaveContextInput): Promise<AcademicContext>
    subjectStates(): Promise<UserSubjectState[]>
    setSubjectStatus(input: SetSubjectStatusInput): Promise<void>
  }

  items: {
    list(): Promise<AcademicItem[]>
    create(input: CreateItemInput): Promise<AcademicItem>
    setDone(id: string, done: boolean): Promise<void>
    remove(id: string): Promise<void>
  }

  resources: {
    list(): Promise<Resource[]>
    create(input: CreateResourceInput): Promise<Resource>
    remove(id: string): Promise<void>
  }
}

/**
 * A curriculum resolved into everything the plan screen needs in one round trip.
 *
 * `prerequisites` being empty is **not** the same as a plan having no
 * correlativas — UNR FCEIA publishes none, and screens must say so rather than
 * let an empty list read as "nothing blocks you". Every backend must preserve
 * that distinction.
 */
export interface CurriculumBundle {
  curriculum: Curriculum | null
  /** The carrera this plan belongs to — what the student calls their degree. */
  programName: string | null
  subjects: CurriculumSubject[]
  prerequisites: PrerequisiteEdge[]
  /**
   * Does the source publish correlativas for this plan at all?
   *
   * This field is the distinction, and it exists because the type could not
   * express it before: with only `prerequisites`, an empty array meant both "we
   * asked and there are none" and "nobody has told us". Callers were left to
   * infer from `prerequisites.length === 0`, which answers UNKNOWN for a plan
   * that genuinely has no correlativas — Campus asserting an academic fact it
   * does not have.
   *
   * `false` → an empty `prerequisites` array means UNKNOWN. Never render it as
   * "nothing blocks you".
   */
  prerequisitesKnown: boolean
  /** Why they are unknown, in the student's language. Only meaningful when `prerequisitesKnown` is false. */
  prerequisitesNote: string | null
}

export interface SaveContextInput {
  institutionId: string | null
  academicUnitId: string | null
  programId: string | null
  curriculumId: string | null
  unmappedLabel: string | null
}

export interface SetSubjectStatusInput {
  curriculumSubjectId: string
  /** `null` clears the stored status, returning the subject to derived state. */
  status: StoredSubjectStatus | null
  grade?: number | null
}

export interface CreateItemInput {
  title: string
  kind: AcademicItemKind
  curriculumSubjectId: string | null
  dueAt: string | null
  notes?: string | null
}

export interface CreateResourceInput {
  title: string
  kind: Extract<ResourceKind, 'link' | 'note'>
  curriculumSubjectId: string | null
  url: string | null
  body: string | null
}

/**
 * Errors reach the student, so they are written for a student.
 *
 * `context` is the human sentence; `cause` is the technical detail worth keeping.
 */
export function backendError(context: string, cause: string): never {
  throw new Error(`${context}: ${cause}`)
}
