import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AcademicItem, AcademicItemKind, Resource, ResourceKind } from '@/domain/types'
import {
  toAcademicItem,
  toResource,
  type AcademicItemRow,
  type ResourceRow,
} from '@/lib/db/mappers'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'

const ITEM_COLUMNS = 'id, curriculum_subject_id, kind, title, starts_at, due_at, status, notes'
const RESOURCE_COLUMNS =
  'id, curriculum_subject_id, kind, title, url, storage_path, body, created_at'

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`)
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) fail('Sesión', 'no hay una sesión activa')
  return id
}

// --- Academic items ----------------------------------------------------------

export function useAcademicItems() {
  return useQuery({
    queryKey: queryKeys.academicItems,
    queryFn: async (): Promise<AcademicItem[]> => {
      const { data, error } = await supabase
        .from('academic_items')
        .select(ITEM_COLUMNS)
        .order('due_at', { ascending: true, nullsFirst: false })
      if (error) fail('No pudimos cargar tus entregas', error.message)
      return (data as AcademicItemRow[]).map(toAcademicItem)
    },
  })
}

export interface CreateItemInput {
  title: string
  kind: AcademicItemKind
  curriculumSubjectId: string | null
  dueAt: string | null
  notes?: string | null
}

export function useCreateAcademicItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateItemInput): Promise<AcademicItem> => {
      const userId = await requireUserId()

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
      if (error) fail('No pudimos guardar la entrega', error.message)

      return toAcademicItem(data as AcademicItemRow)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academicItems })
    },
  })
}

export function useToggleAcademicItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from('academic_items')
        .update({ status: done ? 'done' : 'open' })
        .eq('id', id)
      if (error) fail('No pudimos actualizar la entrega', error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academicItems })
    },
  })
}

export function useDeleteAcademicItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('academic_items').delete().eq('id', id)
      if (error) fail('No pudimos borrar la entrega', error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academicItems })
    },
  })
}

// --- Resources ---------------------------------------------------------------

export function useResources() {
  return useQuery({
    queryKey: queryKeys.resources,
    queryFn: async (): Promise<Resource[]> => {
      const { data, error } = await supabase
        .from('resources')
        .select(RESOURCE_COLUMNS)
        .order('created_at', { ascending: false })
      if (error) fail('No pudimos cargar tu material', error.message)
      return (data as ResourceRow[]).map(toResource)
    },
  })
}

export interface CreateResourceInput {
  title: string
  kind: Extract<ResourceKind, 'link' | 'note'>
  curriculumSubjectId: string | null
  url: string | null
  body: string | null
}

export function useCreateResource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateResourceInput): Promise<Resource> => {
      const userId = await requireUserId()

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
      if (error) fail('No pudimos guardar el material', error.message)

      return toResource(data as ResourceRow)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resources })
    },
  })
}

export function useDeleteResource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('resources').delete().eq('id', id)
      if (error) fail('No pudimos borrar el material', error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resources })
    },
  })
}
