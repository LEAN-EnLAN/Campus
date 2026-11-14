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
  CampusCalendar: () => <p>calendario</p>,
}))

const Calendar = Route.options.component as () => ReactNode

beforeEach(() => {
  state.isLoading = false
  state.items = []
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
})
