import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/toast'
import type { AcademicItem } from '@/domain/types'
import { BackendProvider } from '@/lib/backends/context'
import type { CampusBackend, CreateItemInput } from '@/lib/backends/types'

import { useCreateAcademicItem } from './queries'

const input: CreateItemInput = {
  title: 'TP 1 de Álgebra',
  kind: 'assignment',
  curriculumSubjectId: null,
  dueAt: null,
}

function mount(create: (input: CreateItemInput) => Promise<AcademicItem>) {
  const backend = { items: { list: async () => [], create } } as unknown as CampusBackend
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BackendProvider backend={backend}>{children}</BackendProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
  return renderHook(() => useCreateAcademicItem(), { wrapper })
}

describe('creating an item', () => {
  it('says "Guardado" with the title, wherever it was created from', async () => {
    const { result } = mount(async (values) => ({
      id: 'i1',
      ...values,
      startsAt: null,
      status: 'open',
      notes: null,
    }))

    await act(() => result.current.mutateAsync(input))

    expect(screen.getByRole('status')).toHaveTextContent('Guardado: TP 1 de Álgebra')
  })

  it('says nothing on failure: the open dialog shows the error next to the draft', async () => {
    const { result } = mount(vi.fn().mockRejectedValue(new Error('No pudimos guardar')))

    await act(async () => {
      await result.current.mutateAsync(input).catch(() => undefined)
    })

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
