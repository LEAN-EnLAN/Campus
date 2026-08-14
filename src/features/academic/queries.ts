import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { computeSubjectViews, groupByYear } from '@/domain/availability'
import { computeProgress } from '@/domain/progress'
import type { AcademicContext, Curriculum, SubjectView, UserSubjectState } from '@/domain/types'
import { useBackend } from '@/lib/backends/context'
import type { SaveContextInput, SetSubjectStatusInput } from '@/lib/backends/types'
import { queryKeys } from '@/lib/query-keys'

export type { SaveContextInput, SetSubjectStatusInput }

/** Academic reference data does not change during a session. */
const REFERENCE = { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY }

// --- Onboarding cascade ------------------------------------------------------

export function useInstitutions() {
  const backend = useBackend()
  return useQuery({
    queryKey: queryKeys.institutions,
    ...REFERENCE,
    queryFn: () => backend.catalog.institutions(),
  })
}

export function useAcademicUnits(institutionId: string | null) {
  const backend = useBackend()
  return useQuery({
    queryKey: queryKeys.academicUnits(institutionId),
    enabled: institutionId !== null,
    ...REFERENCE,
    queryFn: () => backend.catalog.academicUnits(institutionId as string),
  })
}

export function usePrograms(academicUnitId: string | null) {
  const backend = useBackend()
  return useQuery({
    queryKey: queryKeys.programs(academicUnitId),
    enabled: academicUnitId !== null,
    ...REFERENCE,
    queryFn: () => backend.catalog.programs(academicUnitId as string),
  })
}

export function useCurricula(programId: string | null) {
  const backend = useBackend()
  return useQuery({
    queryKey: queryKeys.curricula(programId),
    enabled: programId !== null,
    ...REFERENCE,
    queryFn: () => backend.catalog.curricula(programId as string),
  })
}

// --- The student's own context ----------------------------------------------

export function useAcademicContext() {
  const backend = useBackend()
  return useQuery({
    queryKey: queryKeys.academicContext,
    queryFn: () => backend.academic.context(),
  })
}

export function useSaveAcademicContext() {
  const queryClient = useQueryClient()
  const backend = useBackend()

  return useMutation({
    mutationFn: (input: SaveContextInput) => backend.academic.saveContext(input),
    onSuccess: (context) => {
      // Write the result straight into the cache. Invalidating alone leaves the
      // previous value (null) readable during the refetch, and anything routing on
      // "has no context" would bounce the student back to onboarding.
      queryClient.setQueryData(queryKeys.academicContext, context)
      void queryClient.invalidateQueries({ queryKey: queryKeys.academicContext })
      void queryClient.invalidateQueries({ queryKey: queryKeys.subjectStates })
    },
  })
}

// --- Curriculum + student state → resolved plan ------------------------------

export function useCurriculumBundle(curriculumId: string | null) {
  const backend = useBackend()
  return useQuery({
    queryKey: queryKeys.curriculum(curriculumId),
    enabled: curriculumId !== null,
    ...REFERENCE,
    queryFn: () => backend.catalog.curriculumBundle(curriculumId as string),
  })
}

export function useSubjectStates() {
  const backend = useBackend()
  return useQuery({
    queryKey: queryKeys.subjectStates,
    queryFn: (): Promise<UserSubjectState[]> => backend.academic.subjectStates(),
  })
}

export function useSetSubjectStatus() {
  const queryClient = useQueryClient()
  const backend = useBackend()

  return useMutation({
    mutationFn: (input: SetSubjectStatusInput) => backend.academic.setSubjectStatus(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.subjectStates })
    },
  })
}

// --- The composed view every screen actually consumes ------------------------

export interface AcademicPlan {
  context: AcademicContext | null
  curriculum: Curriculum | null
  programName: string | null
  /**
   * How many correlativa edges this plan actually declares.
   *
   * Zero is meaningful, not empty: UNR FCEIA publishes the plan but not the
   * correlatividades, so screens must say "no las tenemos" rather than let
   * silence read as "nada te bloquea".
   */
  prerequisiteCount: number
  views: SubjectView[]
  byYear: ReturnType<typeof groupByYear>
  progress: ReturnType<typeof computeProgress>
  subjectById: Map<string, SubjectView>
  isLoading: boolean
  error: Error | null
  /** The student is using Campus without a mapped plan (CAP-ONBOARD-002). */
  isUnmapped: boolean
  hasContext: boolean
  /** The context query has resolved at least once and is not refetching. */
  contextSettled: boolean
  /**
   * The context fetch itself failed. Distinct from `!hasContext`: a network error
   * must never be read as "this student has no carrera".
   */
  contextError: Error | null
}

/**
 * Resolve the student's plan.
 *
 * The derivation itself lives in `src/domain` — this hook only fetches and hands
 * the pieces over. That is CAP-PLAN-002: availability is never recomputed inside
 * a component, and it does not care which backend produced the data.
 */
export function useAcademicPlan(): AcademicPlan {
  const contextQuery = useAcademicContext()
  const context = contextQuery.data ?? null

  const bundleQuery = useCurriculumBundle(context?.curriculumId ?? null)
  const statesQuery = useSubjectStates()

  const subjects = bundleQuery.data?.subjects
  const prerequisites = bundleQuery.data?.prerequisites
  const states = statesQuery.data

  const views = useMemo(() => {
    if (!subjects || !prerequisites || !states) return []
    return computeSubjectViews({ subjects, prerequisites, states })
  }, [subjects, prerequisites, states])

  const byYear = useMemo(() => groupByYear(views), [views])
  const progress = useMemo(() => computeProgress(views), [views])
  const subjectById = useMemo(() => new Map(views.map((v) => [v.id, v])), [views])

  return {
    context,
    curriculum: bundleQuery.data?.curriculum ?? null,
    programName: bundleQuery.data?.programName ?? null,
    prerequisiteCount: bundleQuery.data?.prerequisites.length ?? 0,
    views,
    byYear,
    progress,
    subjectById,
    isLoading:
      contextQuery.isLoading ||
      (context?.curriculumId != null && (bundleQuery.isLoading || statesQuery.isLoading)),
    error:
      (contextQuery.error as Error | null) ??
      (bundleQuery.error as Error | null) ??
      (statesQuery.error as Error | null),
    isUnmapped: context !== null && context.curriculumId === null,
    hasContext: context !== null,
    contextSettled: !contextQuery.isLoading && !contextQuery.isFetching,
    contextError: (contextQuery.error as Error | null) ?? null,
  }
}
