import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { edge, state, subject } from '@/domain/test-fixtures'
import type { AcademicItem } from '@/domain/types'
import { dateOnlyDueAt } from '@/features/items/due'
import type { CampusBackend } from '@/lib/backends/types'

import {
  emptyStore,
  fakeCampusBackend,
  renderScreen,
} from '../../../tests/support/fake-campus-backend'
import { BlueTodayScreen } from './blue-today-screen'

function inDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return dateOnlyDueAt(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function item(id: string, title: string, days: number, over: Partial<AcademicItem> = {}) {
  return {
    id,
    curriculumSubjectId: null,
    kind: 'task',
    title,
    startsAt: null,
    dueAt: inDays(days),
    status: 'open',
    notes: null,
    ...over,
  } satisfies AcademicItem
}

function backendWith(items: AcademicItem[]) {
  const store = emptyStore({
    subjects: [
      subject('fis', 'Física I'),
      subject('am1', 'Análisis I'),
      subject('am2', 'Análisis II', { yearLevel: 2 }),
    ],
    prerequisites: [edge('am2', 'am1', 'to_pass')],
    states: [state('am1', 'regularized'), state('fis', 'in_progress')],
  })
  const base = fakeCampusBackend(store)
  return { ...base, items: { list: async () => items } } as unknown as CampusBackend
}

describe('Hoy with the Radar', () => {
  it('puts the next thing in the hero with its countdown', async () => {
    await renderScreen(
      <BlueTodayScreen />,
      backendWith([
        item('p', 'Primer parcial', 2, { kind: 'midterm', curriculumSubjectId: 'fis' }),
      ]),
    )
    const hero = await screen.findByRole('region', { name: 'Primer parcial' })
    expect(within(hero).getByText('2')).toBeInTheDocument()
    expect(within(hero).getByText('días')).toBeInTheDocument()
    expect(within(hero).getByText(/Lo próximo · Parcial/)).toBeInTheDocument()
    expect(within(hero).getByRole('link', { name: /Ir a la materia/ })).toHaveAttribute(
      'href',
      '/courses/fis',
    )
  })

  it('shows the other insights as cards and keeps the lists', async () => {
    await renderScreen(
      <BlueTodayScreen />,
      backendWith([item('late', 'Informe', -1), item('p', 'Parcial', 3, { kind: 'midterm' })]),
    )
    const radar = await screen.findByRole('region', { name: 'Radar' })
    expect(within(radar).getByRole('heading', { name: 'Atrasada: Informe' })).toBeInTheDocument()
    expect(within(radar).getByRole('heading', { name: 'Rendí Análisis I' })).toBeInTheDocument()
    expect(within(radar).getByText('Habilita el final de 1 materia')).toBeInTheDocument()
    // The day lists are still there, below.
    expect(screen.getByRole('heading', { name: /Atrasadas/ })).toBeInTheDocument()
  })

  it('says it is live and that it runs on this device', async () => {
    await renderScreen(<BlueTodayScreen />, backendWith([]))
    expect(await screen.findByText('Radar · actualizado recién')).toBeInTheDocument()
    expect(screen.getByText(/Corre en este dispositivo, no envía tus datos/)).toBeInTheDocument()
  })

  it('offers to add a date when everything is clear', async () => {
    const user = userEvent.setup()
    await renderScreen(<BlueTodayScreen />, backendWith([]))
    const radar = await screen.findByRole('region', { name: 'Radar' })
    expect(within(radar).getByRole('heading', { name: 'Estás al día' })).toBeInTheDocument()
    await user.click(within(radar).getByRole('button', { name: /Agregar una fecha/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
