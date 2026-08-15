import {
  toAcademicContext,
  toAcademicItem,
  toAcademicUnit,
  toCurriculum,
  toCurriculumSubject,
  toInstitution,
  toPrerequisiteEdge,
  toProgram,
  toResource,
  toUserSubjectState,
  type AcademicContextRow,
  type AcademicItemRow,
  type AcademicUnitRow,
  type CurriculumRow,
  type CurriculumSubjectRow,
  type InstitutionRow,
  type PrerequisiteRow,
  type ProgramRow,
  type ResourceRow,
  type UserSubjectStateRow,
} from '@/lib/db/mappers'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase as defaultClient } from '@/lib/supabase'
import type { PrerequisiteEdge } from '@/domain/types'

import { backendError, type CampusBackend, type CurriculumBundle } from './types'

/**
 * The CLOUD backend: Supabase Auth + Postgres + RLS.
 *
 * This is the POC's behaviour, moved behind the seam without changing it. Row
 * filtering is RLS's job, not this file's — the queries deliberately do not add
 * `.eq('user_id', ...)` guards, because the database enforces ownership and
 * `tests/db/rls.test.ts` proves it.
 *
 * This module and `src/lib/db/**` are the ONLY places allowed to know Postgres
 * column names.
 */

const ITEM_COLUMNS = 'id, curriculum_subject_id, kind, title, starts_at, due_at, status, notes'
const RESOURCE_COLUMNS =
  'id, curriculum_subject_id, kind, title, url, storage_path, body, created_at'
const CONTEXT_COLUMNS =
  'id, institution_id, academic_unit_id, program_id, curriculum_id, unmapped_label, is_active'

async function requireUserId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) backendError('Sesión', 'no hay una sesión activa')
  return id
}

export function createSupabaseBackend(client?: SupabaseClient): CampusBackend {
  // Injected only by the conformance suite, which needs a client carrying a
  // real test user's JWT so RLS applies exactly as it does in the app. The
  // default is the module singleton, so production behaviour is unchanged.
  const supabase = client ?? defaultClient
  return {
    kind: 'cloud',

    catalog: {
      async institutions() {
        const { data, error } = await supabase
          .from('institutions')
          .select('id, slug, name, short_name, country')
          .order('name')
        if (error) backendError('No pudimos cargar las universidades', error.message)
        return (data as InstitutionRow[]).map(toInstitution)
      },

      async academicUnits(institutionId) {
        const { data, error } = await supabase
          .from('academic_units')
          .select('id, institution_id, parent_id, kind, name, slug')
          .eq('institution_id', institutionId)
          .order('name')
        if (error) backendError('No pudimos cargar las facultades', error.message)
        return (data as AcademicUnitRow[]).map(toAcademicUnit)
      },

      async programs(academicUnitId) {
        const { data, error } = await supabase
          .from('programs')
          .select('id, academic_unit_id, name, degree_type, duration_hint')
          .eq('academic_unit_id', academicUnitId)
          .order('name')
        if (error) backendError('No pudimos cargar las carreras', error.message)
        return (data as ProgramRow[]).map(toProgram)
      },

      async curricula(programId) {
        const { data, error } = await supabase
          .from('curricula')
          .select('id, program_id, name, version, source_url, source_kind, source_fetched_at')
          .eq('program_id', programId)
          .order('version', { ascending: false })
        if (error) backendError('No pudimos cargar los planes', error.message)
        return (data as CurriculumRow[]).map(toCurriculum)
      },

      async curriculumBundle(curriculumId): Promise<CurriculumBundle> {
        const [curriculumResult, subjectsResult] = await Promise.all([
          supabase
            .from('curricula')
            .select(
              'id, program_id, name, version, source_url, source_kind, source_fetched_at, prerequisites_known, prerequisites_note, programs (name)',
            )
            .eq('id', curriculumId)
            // `maybeSingle`, not `single`. A plan we do not have is a QUESTION
            // with an answer — "we do not know your correlativas" — not a
            // database error. `single()` threw, so the cloud adapter exploded
            // where the local one answered UNKNOWN: the exact behavioural drift
            // the conformance suite exists to catch.
            .maybeSingle(),
          supabase
            .from('curriculum_subjects')
            .select(
              'id, curriculum_id, subject_id, year_level, term, credits, elective, display_order, subjects (code, name, normalized_name)',
            )
            .eq('curriculum_id', curriculumId)
            .order('year_level')
            .order('display_order'),
        ])

        if (curriculumResult.error)
          backendError('No pudimos cargar el plan', curriculumResult.error.message)

        if (!curriculumResult.data) {
          // Identical to LocalBackend's answer for an unknown plan. An absent
          // plan must never read as "nothing blocks you".
          return {
            curriculum: null,
            programName: null,
            subjects: [],
            prerequisites: [],
            prerequisitesKnown: false,
            prerequisitesNote: 'No encontramos este plan en el catálogo.',
          }
        }
        if (subjectsResult.error)
          backendError('No pudimos cargar las materias', subjectsResult.error.message)

        const subjects = (subjectsResult.data as unknown as CurriculumSubjectRow[]).map(
          toCurriculumSubject,
        )

        // Edges are scoped to this curriculum's subjects, so a plan version can
        // never pull correlativas from another version.
        const ids = subjects.map((s) => s.id)
        let prerequisites: PrerequisiteEdge[] = []
        if (ids.length > 0) {
          const { data, error } = await supabase
            .from('prerequisites')
            .select('curriculum_subject_id, required_curriculum_subject_id, kind')
            .in('curriculum_subject_id', ids)
          if (error) backendError('No pudimos cargar las correlativas', error.message)
          prerequisites = (data as PrerequisiteRow[]).map(toPrerequisiteEdge)
        }

        // PostgREST embeds arrive as an object or a single-element array depending
        // on how the relationship is inferred; accept both.
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
          // Read, never derived from `prerequisites.length`. An empty edge list
          // is the one thing this flag exists to disambiguate, so deriving it
          // from that list would answer the question with the question.
          prerequisitesKnown: curriculumRow.prerequisites_known,
          prerequisitesNote: curriculumRow.prerequisites_note,
          subjects,
          prerequisites,
        }
      },
    },

    academic: {
      async context() {
        const { data, error } = await supabase
          .from('user_academic_contexts')
          .select(CONTEXT_COLUMNS)
          .eq('is_active', true)
          .maybeSingle()
        if (error) backendError('No pudimos cargar tu contexto académico', error.message)
        return data ? toAcademicContext(data as AcademicContextRow) : null
      },

      async saveContext(input) {
        const userId = await requireUserId(supabase)

        // One active context per user is a unique index; deactivate before inserting.
        const { error: deactivateError } = await supabase
          .from('user_academic_contexts')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('is_active', true)
        if (deactivateError)
          backendError('No pudimos guardar tu carrera', deactivateError.message)

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
          .select(CONTEXT_COLUMNS)
          .single()
        if (error) backendError('No pudimos guardar tu carrera', error.message)

        return toAcademicContext(data as AcademicContextRow)
      },

      async subjectStates() {
        const { data, error } = await supabase
          .from('user_subject_states')
          .select('curriculum_subject_id, status, grade, started_at, completed_at, notes')
        if (error) backendError('No pudimos cargar tu progreso', error.message)
        return (data as UserSubjectStateRow[]).map(toUserSubjectState)
      },

      async setSubjectStatus({ curriculumSubjectId, status, grade }) {
        const userId = await requireUserId(supabase)

        if (status === null) {
          const { error } = await supabase
            .from('user_subject_states')
            .delete()
            .eq('user_id', userId)
            .eq('curriculum_subject_id', curriculumSubjectId)
          if (error) backendError('No pudimos actualizar la materia', error.message)
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
        if (error) backendError('No pudimos actualizar la materia', error.message)
      },
    },

    items: {
      async list() {
        const { data, error } = await supabase
          .from('academic_items')
          .select(ITEM_COLUMNS)
          .order('due_at', { ascending: true, nullsFirst: false })
        if (error) backendError('No pudimos cargar tus entregas', error.message)
        return (data as AcademicItemRow[]).map(toAcademicItem)
      },

      async create(input) {
        const userId = await requireUserId(supabase)
        const { data, error } = await supabase
          .from('academic_items')
          .insert({
            user_id: userId,
            title: input.title.trim(),
            kind: input.kind,
            curriculum_subject_id: input.curriculumSubjectId,
            due_at: input.dueAt,
            notes: input.notes?.trim() || null,
          })
          .select(ITEM_COLUMNS)
          .single()
        if (error) backendError('No pudimos guardar la entrega', error.message)
        return toAcademicItem(data as AcademicItemRow)
      },

      async setDone(id, done) {
        const { error } = await supabase
          .from('academic_items')
          .update({ status: done ? 'done' : 'open' })
          .eq('id', id)
        if (error) backendError('No pudimos actualizar la entrega', error.message)
      },

      async remove(id) {
        const { error } = await supabase.from('academic_items').delete().eq('id', id)
        if (error) backendError('No pudimos borrar la entrega', error.message)
      },
    },

    resources: {
      async list() {
        const { data, error } = await supabase
          .from('resources')
          .select(RESOURCE_COLUMNS)
          .order('created_at', { ascending: false })
        if (error) backendError('No pudimos cargar tu material', error.message)
        return (data as ResourceRow[]).map(toResource)
      },

      async create(input) {
        const userId = await requireUserId(supabase)
        const { data, error } = await supabase
          .from('resources')
          .insert({
            user_id: userId,
            title: input.title.trim(),
            kind: input.kind,
            curriculum_subject_id: input.curriculumSubjectId,
            url: input.kind === 'link' ? input.url : null,
            body: input.kind === 'note' ? input.body : null,
          })
          .select(RESOURCE_COLUMNS)
          .single()
        if (error) backendError('No pudimos guardar el material', error.message)
        return toResource(data as ResourceRow)
      },

      async remove(id) {
        const { error } = await supabase.from('resources').delete().eq('id', id)
        if (error) backendError('No pudimos borrar el material', error.message)
      },
    },
  }
}
