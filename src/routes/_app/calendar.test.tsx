import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AcademicItem } from '@/domain/types'

import { Route } from './calendar'

const state = vi.hoisted(() => ({
  isLoading: false,
  items: [] as AcademicItem[],
}))

vi.mock('@/features/items/queries', () => ({
  useAcademicItems: () => ({
    data: state.isLoading ? undefined : state.items,
    isLoading: state.isLoading,
    error: null,
    refetch: vi.fn(),
  }),
}))
// The grid itself is not what is under test: only the route's loading/empty decision.
vi.mock('@/features/calendar/campus-calendar', () => ({
  CampusCalendar: ({ focusDate }: { focusDate?: string }) => (
    <p>calendario {focusDate ?? 'sin fecha'}</p>
  ),
}))

const Calendar = Route.options.component as () => ReactNode
const search = vi.spyOn(Route, 'useSearch')

beforeEach(() => {
  state.isLoading = false
  state.items = []
  search.mockReturnValue({})
})

describe('Calendario', () => {
  it('shows a skeleton while loading, never "Todavía no anotaste nada"', () => {
    state.isLoading = true
    render(<Calendar />)

    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    expect(screen.queryByText('Todavía no anotaste nada')).toBeNull()
  })

  it('says it is empty only once the dates have loaded and there are none', () => {
    render(<Calendar />)

    expect(screen.getByText('Todavía no anotaste nada')).toBeInTheDocument()
    expect(screen.queryByText('Cargando…')).toBeNull()
  })

  it('hands a ?date= deep link to the grid', () => {
    state.items = [
      {
        id: 'i1',
        curriculumSubjectId: null,
        kind: 'midterm',
        title: 'Parcial',
        startsAt: null,
        dueAt: '2026-11-12T13:00:00.000Z',
        status: 'open',
        notes: null,
      },
    ]
    search.mockReturnValue({ date: '2026-11-12' })
    render(<Calendar />)

    expect(screen.getByText('calendario 2026-11-12')).toBeInTheDocument()
  })
})

describe('Calendario search params', () => {
  const validate = Route.options.validateSearch as (s: Record<string, unknown>) => unknown

  it('keeps a real day and drops anything else', () => {
    expect(validate({ date: '2026-11-12' })).toEqual({ date: '2026-11-12' })
    expect(validate({ date: '2026-02-30' })).toEqual({})
    expect(validate({})).toEqual({})
  })
})
