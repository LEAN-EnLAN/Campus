import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/toast'
import type { AcademicItem, Resource } from '@/domain/types'
import { useBackend } from '@/lib/backends/context'
import type {
  CreateItemInput,
  CreateResourceInput,
  UpdateItemPatch,
} from '@/lib/backends/types'
import { queryKeys } from '@/lib/query-keys'

export type { CreateItemInput, CreateResourceInput, UpdateItemPatch }

// --- Academic items ----------------------------------------------------------

export function useAcademicItems() {
  const backend = useBackend()
  return useQuery({
    queryKey: queryKeys.academicItems,
    queryFn: (): Promise<AcademicItem[]> => backend.items.list(),
  })
}

/**
 * Every way of adding a date (quick capture, Hoy, a subject, Finales pendientes)
 * says it worked in the same words. A failure is not toasted: the capture dialog
 * stays open and shows it next to the draft, where the student can retry.
 */
export function useCreateAcademicItem() {
  const queryClient = useQueryClient()
  const backend = useBackend()
  const toast = useToast()

  return useMutation({
    mutationFn: (input: CreateItemInput) => backend.items.create(input),
    onSuccess: (_created, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academicItems })
      toast.show({ message: `Guardado: ${input.title}` })
    },
  })
}

export function useUpdateAcademicItem() {
  const queryClient = useQueryClient()
  const backend = useBackend()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateItemPatch }) =>
      backend.items.update(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academicItems })
    },
  })
}

export function useToggleAcademicItem() {
  const queryClient = useQueryClient()
  const backend = useBackend()

  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      backend.items.setDone(id, done),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academicItems })
    },
  })
}

export function useDeleteAcademicItem() {
  const queryClient = useQueryClient()
  const backend = useBackend()

  return useMutation({
    mutationFn: (id: string) => backend.items.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academicItems })
    },
  })
}

// --- Resources ---------------------------------------------------------------

export function useResources() {
  const backend = useBackend()
  return useQuery({
    queryKey: queryKeys.resources,
    queryFn: (): Promise<Resource[]> => backend.resources.list(),
  })
}

export function useCreateResource() {
  const queryClient = useQueryClient()
  const backend = useBackend()

  return useMutation({
    mutationFn: (input: CreateResourceInput) => backend.resources.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resources })
    },
  })
}

export function useDeleteResource() {
  const queryClient = useQueryClient()
  const backend = useBackend()

  return useMutation({
    mutationFn: (id: string) => backend.resources.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resources })
    },
  })
}
