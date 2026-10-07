import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/toast'
import type { AcademicItem } from '@/domain/types'
import { dateOnlyDueAt } from '@/features/items/due'
import { Route } from '@/routes/_app/today'

import { renderRoute } from '../helpers/render-route'

const state = vi.hoisted(() => ({
  items: [] as AcademicItem[],
  views: [] as { id: string; name: string; status: string; yearLevel: number }[],
  toggle: vi.fn(),
}))

vi.mock('@/features/items/queries', () => ({
  useAcademicItems: () => ({
    data: state.items,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useToggleAcademicItem: () => ({ mutate: state.toggle }),
}))
vi.mock('@/features/academic/queries', () => ({
  useAcademicPlan: () => ({
    views: state.views,
    subjectById: new Map(state.views.map((v) => [v.id, v])),
    hasContext: true,
    isUnmapped: false,
    isLoading: false,
    error: null,
    progress: { total: 10, passed: 1, equivalent: 0 },
  }),
}))

const Today = Route.options.component as () => ReactNode

const NOW = new Date()
const at = (days: number, h = 12) =>
  new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days, h, 0, 0).toISOString()

const item = (id: string, over: Partial<AcademicItem> = {}): AcademicItem => ({
  id,
  curriculumSubjectId: null,
  kind: 'assignment',
  title: id,
  startsAt: null,
  dueAt: null,
  status: 'open',
  notes: null,
  ...over,
})

const mount = () =>
  renderRoute(() => (
    <ToastProvider>
      <Today />
    </ToastProvider>
  ))

beforeEach(() => {
  state.items = []
  state.views = []
  state.toggle = vi.fn()
})

describe('Hoy', () => {
  it('lists the next 14 days under "Próximas", with the days left', async () => {
    state.items = [item('Parcial de Álgebra', { dueAt: at(10), kind: 'midterm' })]
    mount()

    const section = (await screen.findByRole('heading', { name: 'Próximas' })).closest(
      'section',
    )!
    expect(within(section).getByText('Parcial de Álgebra')).toBeInTheDocument()
    expect(within(section).getByText(/En 10 días/)).toBeInTheDocument()
  })

  it('does not call the day empty when something is coming', async () => {
    state.items = [item('Parcial de Álgebra', { dueAt: at(3) })]
    mount()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nada para hoy.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Lo próximo: Parcial de Álgebra, en 3 días.')).toBeInTheDocument()
    expect(screen.queryByText(/No tenés nada para hoy/)).toBeNull()
  })

  it('shows undated items under "Sin fecha", so the calendar footnote is true', async () => {
    state.items = [item('TP 1 sin fecha')]
    mount()

    const section = (await screen.findByRole('heading', { name: 'Sin fecha' })).closest(
      'section',
    )!
    expect(within(section).getByText('TP 1 sin fecha')).toBeInTheDocument()
  })

  it('never shows a time the student did not set', async () => {
    state.items = [
      item('Mi entrega', {
        dueAt: dateOnlyDueAt(NOW.getFullYear(), NOW.getMonth() + 1, NOW.getDate() + 2),
      }),
    ]
    mount()

    await screen.findByText('Mi entrega')
    expect(document.body.textContent).not.toContain('23:59')
  })

  it('says "Hecho" with a way back when something is completed', async () => {
    const user = userEvent.setup()
    state.items = [item('Leer', { dueAt: at(0, 23) })]
    mount()

    await user.click(await screen.findByRole('button', { name: 'Marcar Leer como hecho' }))

    expect(state.toggle).toHaveBeenCalledWith({ id: 'Leer', done: true })
    expect(await screen.findByRole('button', { name: 'Deshacer' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Hecho')

    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(state.toggle).toHaveBeenLastCalledWith({ id: 'Leer', done: false })
  })

  it('files a Regularizada subject under "Final pendiente", not under "Cursando"', async () => {
    state.views = [
      { id: 'a', name: 'Álgebra', status: 'in_progress', yearLevel: 1 },
      { id: 'b', name: 'Física I', status: 'regularized', yearLevel: 1 },
    ]
    mount()

    const cursando = (await screen.findByRole('heading', { name: 'Cursando' })).closest(
      'section',
    )!
    expect(within(cursando).getByText('Álgebra')).toBeInTheDocument()
    expect(within(cursando).queryByText('Física I')).toBeNull()
    const pendiente = screen
      .getByRole('heading', { name: 'Final pendiente' })
      .closest('section')!
    expect(within(pendiente).getByText('Física I')).toBeInTheDocument()
  })
})
