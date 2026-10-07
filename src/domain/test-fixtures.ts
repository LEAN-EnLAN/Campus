import type {
  CurriculumSubject,
  PrerequisiteEdge,
  StoredSubjectStatus,
  UserSubjectState,
} from './types'

/** Shared builders for the domain tests. Not exported from any runtime module. */

export function subject(
  id: string,
  name: string = id,
  overrides: Partial<CurriculumSubject> = {},
): CurriculumSubject {
  return {
    id,
    curriculumId: 'cur-1',
    subjectId: `s-${id}`,
    code: null,
    name,
    normalizedName: name.toLowerCase(),
    yearLevel: 1,
    term: 'anual',
    credits: null,
    elective: false,
    displayOrder: 0,
    ...overrides,
  }
}

export function edge(
  from: string,
  requires: string,
  kind: PrerequisiteEdge['kind'] = 'to_take',
): PrerequisiteEdge {
  return { curriculumSubjectId: from, requiredCurriculumSubjectId: requires, kind }
}

export function state(id: string, status: StoredSubjectStatus): UserSubjectState {
  return {
    curriculumSubjectId: id,
    status,
    grade: null,
    startedAt: null,
    completedAt: null,
    notes: null,
  }
}
