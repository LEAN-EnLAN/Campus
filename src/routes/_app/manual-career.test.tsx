import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { subject } from '@/domain/test-fixtures'

import {
  emptyStore,
  fakeCampusBackend,
  renderScreen,
  type FakeStore,
} from '../../../tests/support/fake-campus-backend'
import { Route as CoursesRoute } from './courses.index'
import { Route as PlanRoute } from './plan'

const Plan = PlanRoute.options.component!
const Courses = CoursesRoute.options.component!

const unmapped = (over: Partial<FakeStore> = {}) =>
  emptyStore({
    context: {
      id: 'ctx',
      institutionId: null,
      academicUnitId: null,
      programId: null,
      curriculumId: null,
      unmappedLabel: 'Tecnicatura en Algo',
      isActive: true,
    },
    ...over,
  })

describe('Plan for a carrera that is not in the catalog', () => {
  it('says what Campus does not do, then lets the student add subjects by hand', async () => {
    const store = unmapped()
    await renderScreen(<Plan />, fakeCampusBackend(store))
    expect(await screen.findByText(/Tu carrera todavía no está en Campus/)).toBeInTheDocument()
    expect(screen.getByText(/No calculamos correlatividades/)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Nombre'), 'Cálculo 1')
    await user.selectOptions(screen.getByLabelText('Año'), '2')
    await user.click(screen.getByRole('button', { name: 'Agregar materia' }))

    expect(await screen.findByRole('heading', { name: '2° año' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Cálculo 1/ })).toBeInTheDocument()
    expect(store.manual).toHaveLength(1)
  })

  it('marks a status and counts only what was entered, with no availability claim', async () => {
    const store = unmapped({
      manual: [
        { id: 'm1', name: 'Cálculo', yearLevel: 1, term: '1c', status: null, grade: null },
        { id: 'm2', name: 'Física', yearLevel: 1, term: '2c', status: null, grade: null },
      ],
    })
    await renderScreen(<Plan />, fakeCampusBackend(store))
    const user = userEvent.setup()
    const control = await screen.findByRole('group', { name: 'Estado de Cálculo' })
    await user.click(within(control).getByRole('button', { name: 'Aprobada' }))

    await waitFor(() => expect(store.manual[0]!.status).toBe('passed'))
    expect(await screen.findByText('materias que cargaste')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '2')

    const page = document.body.textContent ?? ''
    expect(page).not.toMatch(/Disponible/)
    expect(page).not.toMatch(/Bloqueada/)
    expect(page).not.toMatch(/te falta/i)
    expect(page).not.toMatch(/final bloqueado/i)
  })

  it('removes a subject after a confirmation', async () => {
    const store = unmapped({
      manual: [
        { id: 'm1', name: 'Cálculo', yearLevel: 1, term: '1c', status: null, grade: null },
      ],
    })
    await renderScreen(<Plan />, fakeCampusBackend(store))
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Quitar Cálculo' }))
    expect(store.manual).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Quitar' }))
    await waitFor(() => expect(store.manual).toHaveLength(0))
  })
})

describe('Materias', () => {
  it('shows manual subjects with their status control and the same add form', async () => {
    const store = unmapped({
      manual: [
        {
          id: 'm1',
          name: 'Cálculo',
          yearLevel: 1,
          term: '1c',
          status: 'in_progress',
          grade: null,
        },
      ],
    })
    await renderScreen(<Courses />, fakeCampusBackend(store))
    expect(await screen.findByRole('group', { name: 'Estado de Cálculo' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument()
  })

  it('changes a status from the list row, and keeps the row where it is', async () => {
    const store = emptyStore({
      subjects: [subject('a', 'Álgebra'), subject('b', 'Física')],
      states: [
        {
          curriculumSubjectId: 'a',
          status: 'in_progress',
          grade: null,
          startedAt: null,
          completedAt: null,
          notes: null,
        },
      ],
    })
    await renderScreen(<Courses />, fakeCampusBackend(store))
    const user = userEvent.setup()

    // Opens on "Cursando": only Álgebra is there.
    const control = await screen.findByRole('group', { name: 'Estado de Álgebra' })
    expect(screen.queryByRole('group', { name: 'Estado de Física' })).toBeNull()

    await user.click(within(control).getByRole('button', { name: 'Aprobada' }))
    await waitFor(() => expect(store.states[0]!.status).toBe('passed'))

    // Still listed (and still on the same filter), with its confirmation visible.
    expect(screen.getByRole('group', { name: 'Estado de Álgebra' })).toBeInTheDocument()
    expect(await screen.findByText('Guardado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cursando/, pressed: true })).toBeInTheDocument()
  })

  it('without a carrera it still asks to choose one', async () => {
    await renderScreen(<Courses />, fakeCampusBackend(emptyStore({ context: null })))
    expect(await screen.findByText('Todavía no elegiste tu carrera')).toBeInTheDocument()
  })
})
