import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { computeSubjectViews, groupByYear } from '@/domain/availability'
import { computeProgress } from '@/domain/progress'
import type {
  AcademicContext,
  Curriculum,
  CurriculumSubject,
  PrerequisiteEdge,
  StoredSubjectStatus,
  SubjectView,
  UserSubjectState,
} from '@/domain/types'
import {
  toAcademicContext,
  toAcademicUnit,
  toCurriculum,
  toCurriculumSubject,
  toInstitution,
  toPrerequisiteEdge,
  toProgram,
  toUserSubjectState,
  type AcademicContextRow,
  type AcademicUnitRow,
  type CurriculumRow,
  type CurriculumSubjectRow,
  type InstitutionRow,
  type PrerequisiteRow,
  type ProgramRow,
  type UserSubjectStateRow,
} from '@/lib/db/mappers'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'

/** Academic reference data does not change during a session. */
const REFERENCE = { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY }

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`)
}

// --- Onboarding cascade ------------------------------------------------------

export function useInstitutions() {
  return useQuery({
    queryKey: queryKeys.institutions,
    ...REFERENCE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, slug, name, short_name, country')
        .order('name')
      if (error) fail('No pudimos cargar las universidades', error.message)
      return (data as InstitutionRow[]).map(toInstitution)
    },
  })
}

export function useAcademicUnits(institutionId: string | null) {
  return useQuery({
    queryKey: queryKeys.academicUnits(institutionId),
    enabled: institutionId !== null,
    ...REFERENCE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_units')
        .select('id, institution_id, parent_id, kind, name, slug')
        .eq('institution_id', institutionId as string)
        .order('name')
      if (error) fail('No pudimos cargar las facultades', error.message)
      return (data as AcademicUnitRow[]).map(toAcademicUnit)
    },
  })
}

export function usePrograms(academicUnitId: string | null) {
  return useQuery({
    queryKey: queryKeys.programs(academicUnitId),
    enabled: academicUnitId !== null,
    ...REFERENCE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('id, academic_unit_id, name, degree_type, duration_hint')
        .eq('academic_unit_id', academicUnitId as string)
        .order('name')
      if (error) fail('No pudimos cargar las carreras', error.message)
      return (data as ProgramRow[]).map(toProgram)
    },
  })
}

export function useCurricula(programId: string | null) {
  return useQuery({
    queryKey: queryKeys.curricula(programId),
    enabled: programId !== null,
    ...REFERENCE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('curricula')
        .select('id, program_id, name, version, source_url, source_kind, source_fetched_at')
        .eq('program_id', programId as string)
        .order('version', { ascending: false })
      if (error) fail('No pudimos cargar los planes', error.message)
      return (data as CurriculumRow[]).map(toCurriculum)
    },
  })
}

// --- The student's own context ----------------------------------------------

export function useAcademicContext() {
  return useQuery({
    queryKey: queryKeys.academicContext,
    queryFn: async (): Promise<AcademicContext | null> => {
      const { data, error } = await supabase
        .from('user_academic_contexts')
        .select(
          'id, institution_id, academic_unit_id, program_id, curriculum_id, unmapped_label, is_active',
        )
        .eq('is_active', true)
        .maybeSingle()
      if (error) fail('No pudimos cargar tu contexto académico', error.message)
      return data ? toAcademicContext(data as AcademicContextRow) : null
    },
  })
}

export interface SaveContextInput {
  institutionId: string | null
  academicUnitId: string | null
  programId: string | null
  curriculumId: string | null
  unmappedLabel: string | null
}

export function useSaveAcademicContext() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SaveContextInput) => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) fail('Sesión', 'no hay una sesión activa')

      // One active context per user is a unique index; deactivate before inserting.
      const { error: deactivateError } = await supabase
        .from('user_academic_contexts')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true)
      if (deactivateError) fail('No pudimos guardar tu carrera', deactivateError.message)

      const { data, error } = await supabase
        .from('user_academic_contexts')
        .insert({
          user_id: userId,
          institution_id: input.institutionId,
          academic_unit_id: input.academicUnitId,
          program_id: input.programId,
          curriculum_id: input.curriculumId,
          unmapped_label: input.unmappedLabel,
          is_active: true,
        })
        .select(
          'id, institution_id, academic_unit_id, program_id, curriculum_id, unmapped_label, is_active',
        )
        .single()
      if (error) fail('No pudimos guardar tu carrera', error.message)

      return toAcademicContext(data as AcademicContextRow)
    },
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

interface CurriculumBundle {
  curriculum: Curriculum | null
  /** The carrera this plan belongs to — what the student calls their degree. */
  programName: string | null
  subjects: CurriculumSubject[]
  prerequisites: PrerequisiteEdge[]
}

export function useCurriculumBundle(curriculumId: string | null) {
  return useQuery({
    queryKey: queryKeys.curriculum(curriculumId),
    enabled: curriculumId !== null,
    ...REFERENCE,
    queryFn: async (): Promise<CurriculumBundle> => {
      const id = curriculumId as string

      const [curriculumResult, subjectsResult] = await Promise.all([
        supabase
          .from('curricula')
          .select(
            'id, program_id, name, version, source_url, source_kind, source_fetched_at, programs (name)',
          )
          .eq('id', id)
          .single(),
        supabase
          .from('curriculum_subjects')
          .select(
            'id, curriculum_id, subject_id, year_level, term, credits, elective, display_order, subjects (code, name, normalized_name)',
          )
          .eq('curriculum_id', id)
          .order('year_level')
          .order('display_order'),
      ])

      if (curriculumResult.error)
        fail('No pudimos cargar el plan', curriculumResult.error.message)
      if (subjectsResult.error)
        fail('No pudimos cargar las materias', subjectsResult.error.message)

      const subjects = (subjectsResult.data as unknown as CurriculumSubjectRow[]).map(
        toCurriculumSubject,
      )

      // Edges are scoped to this curriculum's subjects, so a plan version can never
      // pull correlativas from another version.
      const ids = subjects.map((s) => s.id)
      let prerequisites: PrerequisiteEdge[] = []
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from('prerequisites')
          .select('curriculum_subject_id, required_curriculum_subject_id, kind')
          .in('curriculum_subject_id', ids)
        if (error) fail('No pudimos cargar las correlativas', error.message)
        prerequisites = (data as PrerequisiteRow[]).map(toPrerequisiteEdge)
      }

      // PostgREST embeds can arrive as an object or a single-element array
      // depending on how the relationship is inferred; accept both.
      const curriculumRow = curriculumResult.data as unknown as CurriculumRow & {
        programs: { name: string } | { name: string }[] | null
      }
      const embedded = curriculumRow.programs
      const programName = Array.isArray(embedded)
        ? (embedded[0]?.name ?? null)
        : (embedded?.name ?? null)

      return {
        curriculum: toCurriculum(curriculumRow),
        programName,
        subjects,
        prerequisites,
      }
    },
  })
}

export function useSubjectStates() {
  return useQuery({
    queryKey: queryKeys.subjectStates,
    queryFn: async (): Promise<UserSubjectState[]> => {
      const { data, error } = await supabase
        .from('user_subject_states')
        .select('curriculum_subject_id, status, grade, started_at, completed_at, notes')
      if (error) fail('No pudimos cargar tu progreso', error.message)
      return (data as UserSubjectStateRow[]).map(toUserSubjectState)
    },
  })
}

export interface SetSubjectStatusInput {
  curriculumSubjectId: string
  /** `null` clears the stored status, returning the subject to derived state. */
  status: StoredSubjectStatus | null
  grade?: number | null
}

export function useSetSubjectStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ curriculumSubjectId, status, grade }: SetSubjectStatusInput) => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) fail('Sesión', 'no hay una sesión activa')

      if (status === null) {
        const { error } = await supabase
          .from('user_subject_states')
          .delete()
          .eq('user_id', userId)
          .eq('curriculum_subject_id', curriculumSubjectId)
        if (error) fail('No pudimos actualizar la materia', error.message)
        return
      }

      const completedAt =
        status === 'passed' || status === 'equivalent'
          ? new Date().toISOString().slice(0, 10)
          : null

      const { error } = await supabase.from('user_subject_states').upsert(
        {
          user_id: userId,
          curriculum_subject_id: curriculumSubjectId,
          status,
          grade: grade ?? null,
          completed_at: completedAt,
        },
        { onConflict: 'user_id,curriculum_subject_id' },
      )
      if (error) fail('No pudimos actualizar la materia', error.message)
    },
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
   * correlatividades, so screens must say "no las tenemos" rather than let silence
   * read as "nada te bloquea".
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
   * must never be read as 'this student has no carrera'.
   */
  contextError: Error | null
}

/**
 * Resolve the student's plan.
 *
 * The derivation itself lives in `src/domain` — this hook only fetches and hands
 * the pieces over. That is CAP-PLAN-002: availability is never recomputed inside a
 * component.
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
