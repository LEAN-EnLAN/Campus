import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AcademicItem, Resource } from '@/domain/types'
import { useBackend } from '@/lib/backends/context'
import type { CreateItemInput, CreateResourceInput } from '@/lib/backends/types'
import { queryKeys } from '@/lib/query-keys'

export type { CreateItemInput, CreateResourceInput }

// --- Academic items ----------------------------------------------------------

export function useAcademicItems() {
  const backend = useBackend()
  return useQuery({
    queryKey: queryKeys.academicItems,
    queryFn: (): Promise<AcademicItem[]> => backend.items.list(),
  })
}

export function useCreateAcademicItem() {
  const queryClient = useQueryClient()
  const backend = useBackend()

  return useMutation({
    mutationFn: (input: CreateItemInput) => backend.items.create(input),
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
