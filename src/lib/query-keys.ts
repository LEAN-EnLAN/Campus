/**
 * The single source of TanStack Query cache keys.
 *
 * Never inline a key array in a component — mutations invalidate through this
 * factory, and a hand-written key that drifts by one character silently stops
 * invalidating.
 */
export const queryKeys = {
  session: ['session'] as const,

  institutions: ['institutions'] as const,
  academicUnits: (institutionId: string | null) => ['academic-units', institutionId] as const,
  programs: (academicUnitId: string | null) => ['programs', academicUnitId] as const,
  curricula: (programId: string | null) => ['curricula', programId] as const,

  academicContext: ['academic-context'] as const,
  curriculum: (curriculumId: string | null) => ['curriculum', curriculumId] as const,

  subjectStates: ['subject-states'] as const,
  academicItems: ['academic-items'] as const,
  resources: ['resources'] as const,
} as const
