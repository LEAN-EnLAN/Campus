import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { edge, state, subject } from '@/domain/test-fixtures'
import type { AcademicItem, PrerequisiteEdge } from '@/domain/types'
import type { CampusBackend, CreateItemInput } from '@/lib/backends/types'

import {
  emptyStore,
  fakeCampusBackend,
  renderScreen,
  type FakeStore,
} from '../../../tests/support/fake-campus-backend'
import { Route as PlanRoute } from './plan'

const Plan = PlanRoute.options.component!

const twice = (from: string, requires: string): PrerequisiteEdge[] => [
  edge(from, requires, 'to_take'),
  edge(from, requires, 'to_pass'),
]

/** The academic fake plus an in-memory items table, with every write spied on. */
function backendFor(store: FakeStore, items: AcademicItem[] = []) {
  const base = fakeCampusBackend(store)
  const create = vi.fn(async (input: CreateItemInput) => {
    const created: AcademicItem = {
      id: `i${items.length + 1}`,
      curriculumSubjectId: input.curriculumSubjectId,
      kind: input.kind,
      title: input.title,
      startsAt: null,
      dueAt: input.dueAt,
      status: 'open',
      notes: null,
    }
    items.push(created)
    return created
  })
  const setSubjectStatus = vi.spyOn(base.academic, 'setSubjectStatus')
  const setSubjectStatuses = vi.spyOn(base.academic, 'setSubjectStatuses')
  const backend = {
    ...base,
    items: { list: async () => [...items], create },
  } as unknown as CampusBackend
  return { backend, create, setSubjectStatus, setSubjectStatuses }
}

describe('Plan: simulador', () => {
  // Year 1 holds a subject in progress, so its disclosure opens on its own.
  const store = () =>
    emptyStore({
      subjects: [
        subject('am1', 'Análisis Matemático I', { displayOrder: 1, term: '1c' }),
        subject('alg', 'Álgebra', { displayOrder: 2, term: '1c' }),
        subject('fis1', 'Física I', { displayOrder: 3, term: '2c' }),
        subject('am2', 'Análisis Matemático II', { displayOrder: 4, term: '2c' }),
        subject('fis2', 'Física II', { displayOrder: 5, term: 'anual' }),
      ],
      prerequisites: [...twice('am2', 'am1'), ...twice('am2', 'alg'), ...twice('fis2', 'fis1')],
      states: [state('am1', 'regularized'), state('fis1', 'in_progress')],
    })

  async function imagine(user: ReturnType<typeof userEvent.setup>, name: string, to: string) {
    await user.click(screen.getByRole('button', { name: new RegExp(`^Estado de ${name}:`) }))
    await user.click(await screen.findByRole('button', { name: to }))
  }

  it('shows what a hypothesis opens, and never writes', async () => {
    const s = store()
    const spies = backendFor(s)
    await renderScreen(<Plan />, spies.backend)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Simular' }))
    expect(
      screen.getByRole('heading', { name: 'Estás simulando: nada se guarda' }),
    ).toHaveFocus()
    // The real "Finales pendientes" are not part of the simulation.
    expect(screen.queryByRole('region', { name: 'Finales pendientes' })).not.toBeInTheDocument()

    await imagine(user, 'Álgebra', 'Regularizada')
    await imagine(user, 'Física I', 'Regularizada')

    const result = screen.getByRole('region', { name: '¿Qué se te abre?' })
    expect(within(result).getByText('Si pasa esto, se te abren:')).toBeInTheDocument()
    expect(within(result).getByText('Análisis Matemático II')).toBeInTheDocument()
    expect(within(result).getByText('Física II')).toBeInTheDocument()

    // Filter by cuatrimestre: Física II is anual, Análisis Matemático II is 2° cuatr.
    await user.click(within(result).getByRole('button', { name: '2° cuatr.' }))
    expect(within(result).getByText('Análisis Matemático II')).toBeInTheDocument()
    expect(within(result).queryByText('Física II')).not.toBeInTheDocument()

    expect(s.writes).toEqual([])
    expect(s.states.map((x) => [x.curriculumSubjectId, x.status])).toEqual([
      ['am1', 'regularized'],
      ['fis1', 'in_progress'],
    ])
    expect(spies.setSubjectStatus).not.toHaveBeenCalled()
    expect(spies.setSubjectStatuses).not.toHaveBeenCalled()
    expect(spies.create).not.toHaveBeenCalled()
  })

  it('leaving the simulation brings the real plan back', async () => {
    const s = store()
    await renderScreen(<Plan />, backendFor(s).backend)
    const user = userEvent.setup()

    const toggle = await screen.findByRole('button', { name: 'Simular' })
    await user.click(toggle)
    await imagine(user, 'Álgebra', 'Aprobada')
    expect(
      screen.getByRole('button', { name: /^Estado de Álgebra: Aprobada/ }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salir de la simulación' }))
    expect(screen.queryByText('Estás simulando: nada se guarda')).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveFocus()
    expect(screen.getByRole('region', { name: 'Finales pendientes' })).toBeInTheDocument()

    // Back in: nothing imagined survived, Álgebra reads its real status again.
    await user.click(toggle)
    expect(screen.getByText(/Todavía no cambiaste nada/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Estado de Álgebra: Aprobada/ }),
    ).not.toBeInTheDocument()
    expect(s.writes).toEqual([])
  })

  it('is not offered when the plan has no published correlativas', async () => {
    const s = store()
    const base = backendFor(s).backend
    const backend = {
      ...base,
      catalog: {
        curriculumBundle: async () => ({
          ...(await base.catalog.curriculumBundle('plan-1')),
          prerequisites: [],
          prerequisitesKnown: false,
        }),
      },
    } as unknown as CampusBackend
    await renderScreen(<Plan />, backend)
    expect(
      await screen.findByText(/no publicó las correlatividades de este plan/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Simular' })).not.toBeInTheDocument()
  })
})

describe('Plan: finales pendientes', () => {
  /**
   *   am1 ─┬─> am2 ──> sup        (sup also needs alg aprobada to rendir)
   *   alg ─┘
   *   fis1 ──> fis2
   */
  const store = () =>
    emptyStore({
      subjects: [
        subject('am1', 'Análisis Matemático I', { yearLevel: 1, displayOrder: 1 }),
        subject('alg', 'Álgebra', { yearLevel: 1, displayOrder: 2 }),
        subject('fis1', 'Física I', { yearLevel: 1, displayOrder: 3 }),
        subject('am2', 'Análisis Matemático II', { yearLevel: 2, displayOrder: 4 }),
        subject('fis2', 'Física II', { yearLevel: 2, displayOrder: 5 }),
        subject('sup', 'Matemática Superior', { yearLevel: 3, displayOrder: 6 }),
      ],
      prerequisites: [
        ...twice('am2', 'am1'),
        ...twice('am2', 'alg'),
        ...twice('fis2', 'fis1'),
        ...twice('sup', 'am2'),
        edge('sup', 'alg', 'to_pass'),
      ],
      states: [
        state('am1', 'regularized'),
        state('alg', 'regularized'),
        state('fis1', 'regularized'),
        state('am2', 'regularized'),
      ],
    })

  const bookedFinal: AcademicItem = {
    id: 'f1',
    curriculumSubjectId: 'alg',
    kind: 'final',
    title: 'Final de Álgebra',
    startsAt: null,
    dueAt: '2099-03-02T13:00:00.000Z',
    status: 'open',
    notes: null,
  }

  it('orders regularizadas by what their final habilita, ties in plan order', async () => {
    await renderScreen(<Plan />, backendFor(store(), [bookedFinal]).backend)
    const section = await screen.findByRole('region', { name: 'Finales pendientes' })

    const order = within(section)
      .getAllByRole('button', { name: /^Agendar final de / })
      .map((b) => b.getAttribute('aria-label'))
    expect(order).toEqual([
      'Agendar final de Álgebra',
      'Agendar final de Análisis Matemático I',
      'Agendar final de Física I',
      'Agendar final de Análisis Matemático II',
    ])
    expect(within(section).getByText('Habilita 2 materias')).toBeInTheDocument()
    expect(within(section).getAllByText('Habilita 1 materia')).toHaveLength(3)

    // The booked date shows, and am2's final warns that am1 and alg are not aprobadas.
    expect(await within(section).findByText(/Final agendado:/)).toBeInTheDocument()
    const warnings = within(section).getAllByText(/El plan pide tener aprobadas/)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toHaveTextContent('Análisis Matemático I y Álgebra')
  })

  it('names what a final habilita when expanded', async () => {
    await renderScreen(<Plan />, backendFor(store()).backend)
    const section = await screen.findByRole('region', { name: 'Finales pendientes' })
    const user = userEvent.setup()

    await user.click(within(section).getByText('Habilita 2 materias'))
    expect(
      within(section).getByText('Análisis Matemático II (también pide Análisis Matemático I)'),
    ).toBeVisible()
    expect(
      within(section).getByText('Matemática Superior (también pide Análisis Matemático II)'),
    ).toBeVisible()
  })

  it('"Agendar final" opens quick capture on a Final for that subject', async () => {
    const spies = backendFor(store())
    await renderScreen(<Plan />, spies.backend)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Agendar final de Física I' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Agregar final' })).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: 'Tipo' })).toHaveValue('final')
    expect(within(dialog).getByRole('combobox', { name: 'Materia' })).toHaveValue('fis1')

    await user.type(
      within(dialog).getByRole('textbox', { name: /¿Qué es\?/ }),
      'Final de Física I',
    )
    await user.click(within(dialog).getByRole('button', { name: /Guardar/ }))
    await waitFor(() =>
      expect(spies.create).toHaveBeenCalledWith({
        title: 'Final de Física I',
        kind: 'final',
        curriculumSubjectId: 'fis1',
        dueAt: null,
      }),
    )
  })

  it('explains itself when there are no regularizadas', async () => {
    const s = store()
    s.states = [state('am1', 'passed'), state('alg', 'in_progress')]
    await renderScreen(<Plan />, backendFor(s).backend)
    const section = await screen.findByRole('region', { name: 'Finales pendientes' })
    expect(
      within(section).getByText('No tenés materias regularizadas con el final pendiente.'),
    ).toBeInTheDocument()
    expect(
      within(section).queryByRole('button', { name: /Agendar final/ }),
    ).not.toBeInTheDocument()
  })
})
