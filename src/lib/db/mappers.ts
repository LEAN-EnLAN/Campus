import type {
  AcademicContext,
  AcademicItem,
  AcademicUnit,
  Curriculum,
  CurriculumSubject,
  Institution,
  PrerequisiteEdge,
  Program,
  Resource,
  UserSubjectState,
} from '@/domain/types'

/**
 * The boundary between database rows and domain types.
 *
 * This is the ONLY place that knows column names. Screens import domain types so
 * a column rename never reaches a component.
 */

// Shapes as returned by our select() calls. Kept local and structural rather than
// pulled from the generated Database type, because our selects are joins, not tables.

export interface InstitutionRow {
  id: string
  slug: string
  name: string
  short_name: string
  country: string
}

export interface AcademicUnitRow {
  id: string
  institution_id: string
  parent_id: string | null
  kind: AcademicUnit['kind']
  name: string
  slug: string
}

export interface ProgramRow {
  id: string
  academic_unit_id: string
  name: string
  degree_type: string
  duration_hint: string | null
}

export interface CurriculumRow {
  id: string
  program_id: string
  name: string
  version: string
  source_url: string | null
  source_kind: string | null
  source_fetched_at: string | null
}

export interface CurriculumSubjectRow {
  id: string
  curriculum_id: string
  subject_id: string
  year_level: number
  term: CurriculumSubject['term']
  credits: number | string | null
  elective: boolean
  display_order: number
  subjects: { code: string | null; name: string; normalized_name: string } | null
}

export interface PrerequisiteRow {
  curriculum_subject_id: string
  required_curriculum_subject_id: string
  kind: PrerequisiteEdge['kind']
}

export interface UserSubjectStateRow {
  curriculum_subject_id: string
  status: UserSubjectState['status']
  grade: number | string | null
  started_at: string | null
  completed_at: string | null
  notes: string | null
}

export interface AcademicItemRow {
  id: string
  curriculum_subject_id: string | null
  kind: AcademicItem['kind']
  title: string
  starts_at: string | null
  due_at: string | null
  status: AcademicItem['status']
  notes: string | null
}

export interface ResourceRow {
  id: string
  curriculum_subject_id: string | null
  kind: Resource['kind']
  title: string
  url: string | null
  storage_path: string | null
  body: string | null
  created_at: string
}

export interface AcademicContextRow {
  id: string
  institution_id: string | null
  academic_unit_id: string | null
  program_id: string | null
  curriculum_id: string | null
  unmapped_label: string | null
  is_active: boolean
}

/** Postgres `numeric` arrives as a string over the wire. */
function toNumber(value: number | string | null): number | null {
  if (value === null) return null
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

export function toInstitution(row: InstitutionRow): Institution {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    country: row.country,
  }
}

export function toAcademicUnit(row: AcademicUnitRow): AcademicUnit {
  return {
    id: row.id,
    institutionId: row.institution_id,
    parentId: row.parent_id,
    kind: row.kind,
    name: row.name,
    slug: row.slug,
  }
}

export function toProgram(row: ProgramRow): Program {
  return {
    id: row.id,
    academicUnitId: row.academic_unit_id,
    name: row.name,
    degreeType: row.degree_type,
    durationHint: row.duration_hint,
  }
}

export function toCurriculum(row: CurriculumRow): Curriculum {
  const kind = row.source_kind
  return {
    id: row.id,
    programId: row.program_id,
    name: row.name,
    version: row.version,
    sourceUrl: row.source_url,
    sourceKind: kind === 'html' || kind === 'pdf' || kind === 'manual' ? kind : null,
    sourceFetchedAt: row.source_fetched_at,
  }
}

export function toCurriculumSubject(row: CurriculumSubjectRow): CurriculumSubject {
  return {
    id: row.id,
    curriculumId: row.curriculum_id,
    subjectId: row.subject_id,
    code: row.subjects?.code ?? null,
    name: row.subjects?.name ?? 'Materia sin nombre',
    normalizedName: row.subjects?.normalized_name ?? '',
    yearLevel: row.year_level,
    term: row.term,
    credits: toNumber(row.credits),
    elective: row.elective,
    displayOrder: row.display_order,
  }
}

export function toPrerequisiteEdge(row: PrerequisiteRow): PrerequisiteEdge {
  return {
    curriculumSubjectId: row.curriculum_subject_id,
    requiredCurriculumSubjectId: row.required_curriculum_subject_id,
    kind: row.kind,
  }
}

export function toUserSubjectState(row: UserSubjectStateRow): UserSubjectState {
  return {
    curriculumSubjectId: row.curriculum_subject_id,
    status: row.status,
    grade: toNumber(row.grade),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    notes: row.notes,
  }
}

export function toAcademicItem(row: AcademicItemRow): AcademicItem {
  return {
    id: row.id,
    curriculumSubjectId: row.curriculum_subject_id,
    kind: row.kind,
    title: row.title,
    startsAt: row.starts_at,
    dueAt: row.due_at,
    status: row.status,
    notes: row.notes,
  }
}

export function toResource(row: ResourceRow): Resource {
  return {
    id: row.id,
    curriculumSubjectId: row.curriculum_subject_id,
    kind: row.kind,
    title: row.title,
    url: row.url,
    storagePath: row.storage_path,
    body: row.body,
    createdAt: row.created_at,
  }
}

export function toAcademicContext(row: AcademicContextRow): AcademicContext {
  return {
    id: row.id,
    institutionId: row.institution_id,
    academicUnitId: row.academic_unit_id,
    programId: row.program_id,
    curriculumId: row.curriculum_id,
    unmappedLabel: row.unmapped_label,
    isActive: row.is_active,
  }
}
