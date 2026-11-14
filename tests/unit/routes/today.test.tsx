import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/toast'
import type { QuickCaptureValues } from '@/components/quick-capture'
import type { AcademicItem } from '@/domain/types'
import { dateOnlyDueAt } from '@/features/items/due'
import { BlueTodayScreen } from '@/features/blue/blue-today-screen'
import { Route } from '@/routes/_app/today'

import { renderRoute } from '../helpers/render-route'

const state = vi.hoisted(() => ({
  items: [] as AcademicItem[],
  itemsLoading: false,
  views: [] as { id: string; name: string; status: string; yearLevel: number }[],
  toggle: vi.fn<(input: { id: string; done: boolean }) => Promise<void>>(),
  setStatus: vi.fn<(input: Record<string, unknown>) => Promise<void>>(),
  createAsync: vi.fn<(values: QuickCaptureValues) => Promise<void>>(),
  resetCreate: vi.fn(),
  updateAsync:
    vi.fn<(input: { id: string; patch: Record<string, unknown> }) => Promise<void>>(),
  deleteAsync: vi.fn<(id: string) => Promise<void>>(),
  deleteError: null as Error | null,
}))

vi.mock('@/features/items/queries', () => ({
  useAcademicItems: () => ({
    data: state.itemsLoading ? undefined : state.items,
    isLoading: state.itemsLoading,
    error: null,
    refetch: vi.fn(),
  }),
  useToggleAcademicItem: () => ({ mutateAsync: state.toggle }),
  useCreateAcademicItem: () => ({
    mutateAsync: state.createAsync,
    reset: state.resetCreate,
    isPending: false,
    error: null,
  }),
  useUpdateAcademicItem: () => ({
    mutateAsync: state.updateAsync,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
  useDeleteAcademicItem: () => ({
    mutateAsync: state.deleteAsync,
    reset: vi.fn(),
    isPending: false,
    error: state.deleteError,
  }),
}))
vi.mock('@/features/academic/queries', () => ({
  useSetSubjectStatus: () => ({ mutateAsync: state.setStatus }),
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
  state.itemsLoading = false
  state.views = []
  state.toggle = vi.fn().mockResolvedValue(undefined)
  state.setStatus = vi.fn().mockResolvedValue(undefined)
  state.createAsync = vi.fn().mockResolvedValue(undefined)
  state.resetCreate = vi.fn()
  state.updateAsync = vi.fn().mockResolvedValue(undefined)
  state.deleteAsync = vi.fn().mockResolvedValue(undefined)
  state.deleteError = null
})

describe('Hoy', () => {
  it('shows a skeleton while the dates load, never "No hay tareas pendientes"', async () => {
    state.itemsLoading = true
    mount()

    expect(await screen.findByText('Cargando…')).toBeInTheDocument()
    expect(screen.queryByText('No hay tareas pendientes')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar mi primera entrega' })).toBeNull()
  })

  it('lists the next 14 days under "Próximas", with the days left', async () => {
    state.items = [item('Parcial de Álgebra', { dueAt: at(10), kind: 'midterm' })]
    mount()

    const section = (await screen.findByRole('heading', { name: /^Próximas/ })).closest(
      'section',
    )!
    expect(within(section).getByText('Parcial de Álgebra')).toBeInTheDocument()
    expect(within(section).getByText(/En 10 días/)).toBeInTheDocument()
  })

  it('does not call the day empty when something is coming', async () => {
    state.items = [item('Parcial de Álgebra', { dueAt: at(3) })]
    mount()

    expect(await screen.findByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument()
    expect(screen.getByText('Nada para hoy.')).toBeInTheDocument()
    expect(screen.getByText('Lo próximo: Parcial de Álgebra, en 3 días.')).toBeInTheDocument()
    const upcoming = screen.getByRole('heading', { name: /^Próximas/ }).closest('section')!
    expect(within(upcoming).getByText('Parcial de Álgebra')).toBeInTheDocument()
    expect(within(upcoming).getByText(/En 3 días/)).toBeInTheDocument()
    // The page must not claim there are no pending tasks while one is coming.
    expect(screen.queryByText('No hay tareas pendientes')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar mi primera entrega' })).toBeNull()
  })

  it('"Ver próximas" moves focus to the list that holds the next item', async () => {
    const user = userEvent.setup()
    state.items = [item('Parcial de Álgebra', { dueAt: at(3) })]
    mount()

    await user.click(await screen.findByRole('button', { name: 'Ver próximas' }))
    expect(screen.getByRole('heading', { name: /^Próximas/ })).toHaveFocus()
  })

  it('offers "Agregar mi primera entrega" only with zero open items', async () => {
    state.items = [item('Hecho', { dueAt: at(2), status: 'done' })]
    mount()

    expect(await screen.findByText('No hay tareas pendientes')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Agregar mi primera entrega' }),
    ).toBeInTheDocument()
  })

  it('never hides an item past the 14 days: no "primera entrega", and a line that names it', async () => {
    const user = userEvent.setup()
    state.views = [{ id: 'alg', name: 'Álgebra', status: 'in_progress', yearLevel: 1 }]
    const far = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 30, 12)
    const ddmm = `${String(far.getDate()).padStart(2, '0')}/${String(far.getMonth() + 1).padStart(2, '0')}`
    state.items = [
      item('Final de Álgebra', { dueAt: at(30), kind: 'final', curriculumSubjectId: 'alg' }),
      item('TP integrador', { dueAt: at(40) }),
    ]
    mount()

    expect(await screen.findByText('Nada para hoy.')).toBeInTheDocument()
    expect(screen.getByText('Lo próximo: Final de Álgebra, en 30 días.')).toBeInTheDocument()
    expect(screen.queryByText('No hay tareas pendientes')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar mi primera entrega' })).toBeNull()

    const line = screen.getByText(
      `Más adelante: 2 fechas · la próxima es Final de Álgebra (Álgebra), ${ddmm}`,
    )
    // Folded until asked; "Ver más adelante" opens it.
    expect(line.closest('details')).not.toHaveAttribute('open')
    await user.click(screen.getByRole('button', { name: 'Ver más adelante' }))
    expect(line.closest('details')).toHaveAttribute('open')
    expect(screen.getByRole('button', { name: 'Editar TP integrador' })).toBeVisible()
  })

  it('says so inside "Hoy" when only overdue work is left, as one quiet sentence', async () => {
    state.items = [item('Informe viejo', { dueAt: at(-2) })]
    mount()

    const section = (await screen.findByRole('heading', { name: /^Atrasadas/ })).closest(
      'section',
    )!
    expect(within(section).getByText('Informe viejo')).toBeInTheDocument()
    expect(screen.getByText('Tenés 1 pendiente para revisar')).toBeInTheDocument()
    expect(screen.queryByText('No hay tareas pendientes')).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: /^Hoy/ })).toBeNull()
    expect(section.querySelector('.border-dashed')).toBeNull()
  })

  it('shows undated items under "Sin fecha", so the calendar footnote is true', async () => {
    state.items = [item('TP 1 sin fecha')]
    mount()

    const section = (await screen.findByRole('heading', { name: /^Sin fecha/ })).closest(
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

  it('says "Marcada como hecha" with a way back when something is completed', async () => {
    const user = userEvent.setup()
    state.items = [item('Leer', { dueAt: at(0, 23) })]
    mount()

    await user.click(await screen.findByRole('button', { name: 'Marcar Leer como hecho' }))

    expect(state.toggle).toHaveBeenCalledWith({ id: 'Leer', done: true })
    expect(await screen.findByRole('button', { name: 'Deshacer' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Marcada como hecha')

    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(state.toggle).toHaveBeenLastCalledWith({ id: 'Leer', done: false })
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Marcada como pendiente'),
    )
  })

  it('disables the circle while the change is in flight, so a double tap sends one', async () => {
    const user = userEvent.setup()
    let finish: () => void = () => {}
    state.toggle.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)))
    state.items = [item('Leer', { dueAt: at(0, 23) })]
    mount()

    const circle = await screen.findByRole('button', { name: 'Marcar Leer como hecho' })
    await user.dblClick(circle)

    expect(circle).toBeDisabled()
    expect(state.toggle).toHaveBeenCalledOnce()
    finish()
    await waitFor(() => expect(circle).toBeEnabled())
  })

  it('says so in Spanish when marking fails, and offers no Deshacer', async () => {
    const user = userEvent.setup()
    state.toggle.mockRejectedValue(new Error('network down'))
    state.items = [item('Leer', { dueAt: at(0, 23) })]
    mount()

    await user.click(await screen.findByRole('button', { name: 'Marcar Leer como hecho' }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'No pudimos marcarla como hecha. Probá de nuevo.',
      ),
    )
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull()
  })

  it('files a Regularizada subject under "Final pendiente", not under "Cursando"', async () => {
    state.views = [
      { id: 'a', name: 'Álgebra', status: 'in_progress', yearLevel: 1 },
      { id: 'b', name: 'Física I', status: 'regularized', yearLevel: 1 },
    ]
    mount()

    const cursando = (await screen.findByRole('heading', { name: 'Mis materias' })).closest(
      'section',
    )!
    expect(within(cursando).getByText('Álgebra')).toBeInTheDocument()
    expect(within(cursando).queryByText('Física I')).toBeNull()
    const pendiente = screen
      .getByRole('heading', { name: 'Regularizadas (final pendiente)' })
      .closest('section')!
    expect(within(pendiente).getByText('Física I')).toBeInTheDocument()
  })
})

describe('Hoy: direct capture', () => {
  const mountBlueToday = () =>
    renderRoute(() => (
      <ToastProvider>
        <BlueTodayScreen />
      </ToastProvider>
    ))

  it('creates an item from Today and resets the previous mutation state when opened', async () => {
    const user = userEvent.setup()
    mountBlueToday()

    await user.click(await screen.findByRole('button', { name: 'Agregar entrega' }))
    expect(state.resetCreate).toHaveBeenCalledTimes(1)
    await user.type(screen.getByRole('textbox', { name: '¿Qué es?' }), 'TP 3 de Álgebra')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(state.createAsync).toHaveBeenCalledWith({
      title: 'TP 3 de Álgebra',
      kind: 'assignment',
      curriculumSubjectId: null,
      dueAt: null,
    })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Agregar entrega' })).toBeNull(),
    )
  })

  it('keeps a failed capture open with the typed draft intact', async () => {
    const user = userEvent.setup()
    state.createAsync.mockRejectedValue(new Error('No pudimos guardar la entrega'))
    mountBlueToday()

    await user.click(await screen.findByRole('button', { name: 'Agregar entrega' }))
    expect(state.resetCreate).toHaveBeenCalledTimes(1)
    const title = screen.getByRole('textbox', { name: '¿Qué es?' })
    await user.type(title, 'TP 4 de Análisis')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(state.createAsync).toHaveBeenCalledWith({
      title: 'TP 4 de Análisis',
      kind: 'assignment',
      curriculumSubjectId: null,
      dueAt: null,
    })
    expect(await screen.findByRole('dialog', { name: 'Agregar entrega' })).toBeInTheDocument()
    expect(title).toHaveValue('TP 4 de Análisis')
  })
})

describe('Hoy: completing a Final', () => {
  const am2 = { id: 'am2', name: 'Análisis II', status: 'in_progress', yearLevel: 2 }

  it('asks how it went before marking anything done', async () => {
    const user = userEvent.setup()
    state.views = [am2]
    state.items = [
      item('Final AM II', { kind: 'final', curriculumSubjectId: 'am2', dueAt: at(0, 23) }),
    ]
    mount()

    await user.click(
      await screen.findByRole('button', { name: 'Marcar Final AM II como hecho' }),
    )

    expect(
      await screen.findByRole('dialog', { name: /¿Cómo te fue en Final AM II\?/ }),
    ).toBeInTheDocument()
    expect(state.toggle).not.toHaveBeenCalled()
  })

  it('marks it done and offers the new state once the student answers', async () => {
    const user = userEvent.setup()
    state.views = [am2]
    state.items = [
      item('Final AM II', { kind: 'final', curriculumSubjectId: 'am2', dueAt: at(0, 23) }),
    ]
    mount()

    await user.click(
      await screen.findByRole('button', { name: 'Marcar Final AM II como hecho' }),
    )
    await user.click(await screen.findByRole('radio', { name: 'Aprobé' }))
    await user.type(screen.getByLabelText('Nota (opcional)'), '7')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(state.toggle).toHaveBeenCalledWith({ id: 'Final AM II', done: true })
    await waitFor(() => expect(state.setStatus).toHaveBeenCalled())
    expect(state.setStatus).toHaveBeenCalledWith({
      curriculumSubjectId: 'am2',
      status: 'passed',
      grade: 7,
    })
  })

  it('changes nothing when the student cancels', async () => {
    const user = userEvent.setup()
    state.views = [am2]
    state.items = [
      item('Final AM II', { kind: 'final', curriculumSubjectId: 'am2', dueAt: at(0, 23) }),
    ]
    mount()

    await user.click(
      await screen.findByRole('button', { name: 'Marcar Final AM II como hecho' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))

    expect(state.toggle).not.toHaveBeenCalled()
    expect(state.setStatus).not.toHaveBeenCalled()
  })
})

describe('Hoy: editing and deleting an item', () => {
  it('keeps the toggle named "Marcar X como hecho" next to the new actions', async () => {
    state.items = [item('Leer', { dueAt: at(0, 23) })]
    mount()

    expect(
      await screen.findByRole('button', { name: 'Marcar Leer como hecho' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar Leer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar Leer' })).toBeInTheDocument()
  })

  it('edits in the capture dialog, prefilled, and says "Guardado"', async () => {
    const user = userEvent.setup()
    state.items = [item('Parcial 1', { kind: 'midterm', dueAt: at(2, 18) })]
    mount()

    await user.click(await screen.findByRole('button', { name: 'Editar Parcial 1' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar parcial' })
    const title = within(dialog).getByRole('textbox', { name: '¿Qué es?' })
    expect(title).toHaveValue('Parcial 1')
    expect(within(dialog).getByLabelText('Hora')).toHaveValue('18:00')

    await user.clear(title)
    await user.type(title, 'Parcial 1 de Álgebra')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(state.updateAsync).toHaveBeenCalledWith({
      id: 'Parcial 1',
      patch: {
        title: 'Parcial 1 de Álgebra',
        kind: 'midterm',
        curriculumSubjectId: null,
        dueAt: at(2, 18),
      },
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('status')).toHaveTextContent('Guardado: Parcial 1 de Álgebra')
  })

  it('asks before deleting, and deletes on "Eliminar"', async () => {
    const user = userEvent.setup()
    state.items = [item('TP 2', { dueAt: at(1) })]
    mount()

    await user.click(await screen.findByRole('button', { name: 'Eliminar TP 2' }))
    const confirm = screen.getByRole('alertdialog', { name: '¿Eliminar «TP 2»?' })
    expect(confirm).toHaveAccessibleDescription(/No se puede deshacer/)
    await waitFor(() =>
      expect(within(confirm).getByRole('button', { name: 'Cancelar' })).toHaveFocus(),
    )
    expect(state.deleteAsync).not.toHaveBeenCalled()

    await user.click(within(confirm).getByRole('button', { name: 'Eliminar' }))

    expect(state.deleteAsync).toHaveBeenCalledWith('TP 2')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('status')).toHaveTextContent('Eliminado: TP 2')
  })

  it('deletes nothing when the student cancels', async () => {
    const user = userEvent.setup()
    state.items = [item('TP 2', { dueAt: at(1) })]
    mount()

    await user.click(await screen.findByRole('button', { name: 'Eliminar TP 2' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(state.deleteAsync).not.toHaveBeenCalled()
  })

  it('keeps the confirmation open with the reason when deleting fails', async () => {
    const user = userEvent.setup()
    state.items = [item('TP 2', { dueAt: at(1) })]
    state.deleteAsync = vi.fn().mockRejectedValue(new Error('No pudimos borrar la entrega'))
    state.deleteError = new Error('No pudimos borrar la entrega')
    mount()

    await user.click(await screen.findByRole('button', { name: 'Eliminar TP 2' }))
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos borrar la entrega')
  })
})
