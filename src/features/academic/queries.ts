import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { computeSubjectViews, groupByYear } from '@/domain/availability'
import { manualStates, manualToCurriculumSubject } from '@/domain/manual-subjects'
import { computeProgress } from '@/domain/progress'
import type {
  AcademicContext,
  Curriculum,
  ManualSubject,
  SubjectView,
  UserSubjectState,
} from '@/domain/types'
import { useBackend } from '@/lib/backends/context'
import { applyManualBatch, applyStatusBatch } from '@/lib/backends/normalize'
import type {
  AddManualSubjectInput,
  SaveContextInput,
  SetSubjectStatusInput,
} from '@/lib/backends/types'
import { queryKeys } from '@/lib/query-keys'

export type { AddManualSubjectInput, SaveContextInput, SetSubjectStatusInput }

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

// --- Marking subjects ---------------------------------------------------------

/**
 * Every status write shares one scope, so TanStack runs them strictly one after
 * another. Two quick clicks would otherwise read the same vault file, and the
 * second write would be refused as a lost update.
 */
const STATUS_MUTATION = { mutationKey: ['subject-status'], scope: { id: 'subject-status' } }

interface StatusSnapshot {
  states: UserSubjectState[] | undefined
  manual: ManualSubject[] | undefined
}

/**
 * One mutation for one or many subjects.
 *
 * The cache is updated BEFORE the write, with the same function the local
 * backend writes with, so a row answers the click at once and a year of 13 rows
 * does not wait on 13 round trips. A failed write puts the old values back.
 */
function useStatusMutation<TInput>(toInputs: (input: TInput) => SetSubjectStatusInput[]) {
  const queryClient = useQueryClient()
  const backend = useBackend()

  return useMutation({
    ...STATUS_MUTATION,
    mutationFn: (input: TInput) => {
      const inputs = toInputs(input)
      return inputs.length === 1
        ? backend.academic.setSubjectStatus(inputs[0]!)
        : backend.academic.setSubjectStatuses(inputs)
    },
    onMutate: async (input: TInput): Promise<StatusSnapshot> => {
      const inputs = toInputs(input)
      await queryClient.cancelQueries({ queryKey: queryKeys.subjectStates })
      await queryClient.cancelQueries({ queryKey: queryKeys.manualSubjects })
      const snapshot: StatusSnapshot = {
        states: queryClient.getQueryData<UserSubjectState[]>(queryKeys.subjectStates),
        manual: queryClient.getQueryData<ManualSubject[]>(queryKeys.manualSubjects),
      }

      const manualInputs = inputs.filter((i) => i.manual)
      const catalogInputs = inputs.filter((i) => !i.manual)
      if (snapshot.states && catalogInputs.length > 0) {
        queryClient.setQueryData(
          queryKeys.subjectStates,
          applyStatusBatch(snapshot.states, catalogInputs, new Date()),
        )
      }
      if (snapshot.manual && manualInputs.length > 0) {
        queryClient.setQueryData(
          queryKeys.manualSubjects,
          applyManualBatch(snapshot.manual, manualInputs),
        )
      }
      return snapshot
    },
    onError: (_error, _input, snapshot) => {
      if (snapshot?.states) queryClient.setQueryData(queryKeys.subjectStates, snapshot.states)
      if (snapshot?.manual) queryClient.setQueryData(queryKeys.manualSubjects, snapshot.manual)
    },
    onSettled: () => {
      // Refetch once the LAST queued write is done. Refetching in between would
      // overwrite the optimistic value of a write that has not happened yet.
      if (queryClient.isMutating({ mutationKey: STATUS_MUTATION.mutationKey }) > 1) return
      void queryClient.invalidateQueries({ queryKey: queryKeys.subjectStates })
      void queryClient.invalidateQueries({ queryKey: queryKeys.manualSubjects })
    },
  })
}

export function useSetSubjectStatus() {
  return useStatusMutation<SetSubjectStatusInput>((input) => [input])
}

/** "Aprobé todo 2° año": many subjects, one write. */
export function useSetSubjectStatuses() {
  return useStatusMutation<SetSubjectStatusInput[]>((inputs) => inputs)
}

// --- Subjects typed in by hand -------------------------------------------------

export function useManualSubjects(enabled = true) {
  const backend = useBackend()
  return useQuery({
    queryKey: queryKeys.manualSubjects,
    enabled,
    queryFn: () => backend.academic.manualSubjects(),
  })
}

export function useAddManualSubject() {
  const queryClient = useQueryClient()
  const backend = useBackend()

  return useMutation({
    mutationFn: (input: AddManualSubjectInput) => backend.academic.addManualSubject(input),
    onSuccess: (added) => {
      queryClient.setQueryData<ManualSubject[]>(queryKeys.manualSubjects, (all) => [
        ...(all ?? []),
        added,
      ])
      void queryClient.invalidateQueries({ queryKey: queryKeys.manualSubjects })
    },
  })
}

export function useRemoveManualSubject() {
  const queryClient = useQueryClient()
  const backend = useBackend()

  return useMutation({
    mutationFn: (id: string) => backend.academic.removeManualSubject(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.manualSubjects })
      // Entregas and material it had are kept, so their lists are untouched.
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
  /**
   * Does the source publish correlativas at all?
   *
   * Read from the backend, never inferred from `prerequisites.length`. Screens
   * used to ask "are there zero edges?" and render "no las tenemos" — which is
   * a claim about the university, and it is wrong for any plan that genuinely
   * has none.
   */
  prerequisitesKnown: boolean
  prerequisitesNote: string | null
  /** Only meaningful while `isUnmapped`: what the student typed in. */
  manualSubjects: ManualSubject[]
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

  // A student whose carrera is not in the catalog builds their own plan. Manual
  // subjects belong to that situation only: once a real plan is chosen they are
  // not mixed into it.
  const isUnmapped = context !== null && context.curriculumId === null
  const manualQuery = useManualSubjects(isUnmapped)
  const manualSubjects = manualQuery.data

  const bundleSubjects = bundleQuery.data?.subjects
  const prerequisites = isUnmapped ? [] : bundleQuery.data?.prerequisites
  const states = statesQuery.data
  const prerequisitesKnown = isUnmapped ? false : (bundleQuery.data?.prerequisitesKnown ?? true)

  const views = useMemo(() => {
    if (isUnmapped) {
      if (!manualSubjects) return []
      return computeSubjectViews({
        subjects: manualSubjects.map(manualToCurriculumSubject),
        prerequisites: [],
        states: manualStates(manualSubjects),
        prerequisitesKnown: false,
      })
    }
    if (!bundleSubjects || !prerequisites || !states) return []
    return computeSubjectViews({
      subjects: bundleSubjects,
      prerequisites,
      states,
      prerequisitesKnown,
    })
  }, [isUnmapped, manualSubjects, bundleSubjects, prerequisites, states, prerequisitesKnown])

  const byYear = useMemo(() => groupByYear(views), [views])
  const progress = useMemo(() => computeProgress(views), [views])
  const subjectById = useMemo(() => new Map(views.map((v) => [v.id, v])), [views])

  return {
    context,
    curriculum: bundleQuery.data?.curriculum ?? null,
    programName: bundleQuery.data?.programName ?? null,
    prerequisitesKnown,
    prerequisitesNote: isUnmapped ? null : (bundleQuery.data?.prerequisitesNote ?? null),
    manualSubjects: manualSubjects ?? [],
    views,
    byYear,
    progress,
    subjectById,
    isLoading:
      contextQuery.isLoading ||
      (context?.curriculumId != null && (bundleQuery.isLoading || statesQuery.isLoading)) ||
      (isUnmapped && manualQuery.isLoading),
    error:
      (contextQuery.error as Error | null) ??
      (bundleQuery.error as Error | null) ??
      (statesQuery.error as Error | null) ??
      (manualQuery.error as Error | null),
    isUnmapped,
    hasContext: context !== null,
    contextSettled: !contextQuery.isLoading && !contextQuery.isFetching,
    contextError: (contextQuery.error as Error | null) ?? null,
  }
}
