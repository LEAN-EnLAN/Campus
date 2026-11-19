import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { state, subject } from '@/domain/test-fixtures'

import {
  emptyStore,
  fakeCampusBackend,
  renderScreen,
} from '../../../tests/support/fake-campus-backend'
import { Route as CoursesRoute } from './courses.index'
import { Route as PlanRoute } from './plan'

const Courses = CoursesRoute.options.component!
const Plan = PlanRoute.options.component!

const store = () =>
  emptyStore({
    subjects: [
      subject('a', 'Álgebra'),
      subject('b', 'Física I'),
      subject('c', 'Química'),
      subject('d', 'Análisis I'),
    ],
    states: [state('a', 'passed'), state('b', 'in_progress'), state('c', 'regularized')],
  })

describe('Materias: resumen', () => {
  it('words single counts in the singular', async () => {
    await renderScreen(<Courses />, fakeCampusBackend(store()))
    const aside = await screen.findByRole('complementary', { name: 'Resumen de materias' })
    expect(await within(aside).findByText('1 materia cursando')).toBeInTheDocument()
    expect(within(aside).getByText('1 final pendiente')).toBeInTheDocument()
    expect(within(aside).getByText('1 disponible')).toBeInTheDocument()
  })

  it('draws the states as proportional blocks instead of a ring', async () => {
    await renderScreen(<Courses />, fakeCampusBackend(store()))
    expect(
      await screen.findByRole('img', {
        name: '1 disponible, 1 cursando, 1 final pendiente, 1 aprobada',
      }),
    ).toBeInTheDocument()
  })
})

describe('Plan: tu avance', () => {
  it('says the percentage once and shows counts by state beside it', async () => {
    await renderScreen(<Plan />, fakeCampusBackend(store()))
    await screen.findByRole('heading', { name: 'Tu avance' })
    expect(screen.getAllByText(/^\d+%$/)).toHaveLength(1)
    expect(
      screen.getByRole('img', { name: '25% de la carrera: 1 de 4 materias aprobadas' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: '4 materias: 1 aprobada, 1 regularizada, 1 cursando y 1 por cursar',
      }),
    ).toBeInTheDocument()
  })
})
