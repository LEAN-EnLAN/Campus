import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { subject, edge } from '@/domain/test-fixtures'
import type { CurriculumSubject } from '@/domain/types'

import {
  emptyStore,
  fakeCampusBackend,
  renderScreen,
  type FakeStore,
} from '../../../tests/support/fake-campus-backend'
import { ProgressEntryScreen } from './progress-entry-screen'

/** Node 25 ships its own half-working `localStorage`; use a plain one. */
beforeEach(() => {
  const data = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, String(v)),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
      key: () => null,
      length: 0,
    },
  })
})

const plan = (): CurriculumSubject[] => [
  ...Array.from({ length: 5 }, (_, i) =>
    subject(`y1-${i}`, `Materia 1.${i + 1}`, { yearLevel: 1, displayOrder: i }),
  ),
  ...Array.from({ length: 13 }, (_, i) =>
    subject(`y2-${i}`, `Materia 2.${i + 1}`, { yearLevel: 2, displayOrder: i }),
  ),
]

async function open(store: FakeStore) {
  await renderScreen(<ProgressEntryScreen />, fakeCampusBackend(store))
  await screen.findAllByRole('group', { name: /^Estado de / })
}

const rowControl = (name: string) =>
  within(screen.getByRole('group', { name: `Estado de ${name}` }))

describe('Cargar mi avance', () => {
  it('lists the plan by year with a state control per subject', async () => {
    await open(emptyStore({ subjects: plan() }))
    expect(screen.getByRole('heading', { name: '1° año' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2° año' })).toBeInTheDocument()
    expect(screen.getAllByRole('group', { name: /^Estado de / })).toHaveLength(18)
    expect(screen.getByText(/Marcá lo que ya tenés/)).toBeInTheDocument()
  })

  it('a 2nd-year student sets 13 subjects in fewer than 20 actions, without leaving the page', async () => {
    const store = emptyStore({ subjects: plan() })
    await open(store)
    const user = userEvent.setup()
    let actions = 0
    const act = async (el: HTMLElement) => {
      actions += 1
      await user.click(el)
    }

    await act(screen.getByRole('button', { name: 'Aprobé todo 1° año' }))
    for (let i = 1; i <= 13; i += 1) {
      const status = i <= 11 ? /Aprobada/ : /Cursando/
      await act(rowControl(`Materia 2.${i}`).getByRole('button', { name: status }))
    }
    await act(screen.getByRole('button', { name: 'Listo' }))

    expect(actions).toBeLessThan(20)
    await waitFor(() => expect(store.states).toHaveLength(5 + 13))
    expect(store.states.filter((s) => s.status === 'passed')).toHaveLength(5 + 11)
    expect(store.states.filter((s) => s.status === 'in_progress')).toHaveLength(2)
  })

  it('"Aprobé todo" is one bulk write and can be undone', async () => {
    const store = emptyStore({ subjects: plan() })
    await open(store)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Aprobé todo 1° año' }))
    await waitFor(() => expect(store.writes).toHaveLength(1))
    expect(store.writes[0]).toHaveLength(5)
    expect(store.states).toHaveLength(5)
    expect(
      await screen.findByText(/Marcamos 5 materias de 1° año como aprobadas/),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(store.states).toHaveLength(0))
    expect(screen.queryByText(/Marcamos 5 materias/)).toBeNull()
  })

  it('has no year button once the whole year is approved', async () => {
    const store = emptyStore({ subjects: plan() })
    await open(store)
    await userEvent.click(screen.getByRole('button', { name: 'Aprobé todo 1° año' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Aprobé todo 1° año' })).toBeNull(),
    )
    expect(screen.getByText('Todo el 1° año está aprobado')).toBeInTheDocument()
  })

  it('stays silent while entering, then lists contradictions once on "Listo"', async () => {
    const subjects = [
      subject('a', 'Física I', { yearLevel: 1 }),
      subject('b', 'Física II', { yearLevel: 2 }),
    ]
    const store = emptyStore({ subjects, prerequisites: [edge('b', 'a', 'to_pass')] })
    await open(store)
    const user = userEvent.setup()

    // Física II approved while Física I is not: allowed, and quiet.
    await user.click(rowControl('Física II').getByRole('button', { name: /Aprobada/ }))
    await waitFor(() => expect(store.states).toHaveLength(1))
    expect(screen.queryByText(/El plan indica/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'Para revisar' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Listo' }))
    const summary = await screen.findByRole('region', { name: 'Para revisar' })
    expect(
      within(summary).getByText(/1 materia con correlativas pendientes/),
    ).toBeInTheDocument()
    expect(within(summary).getByRole('link', { name: 'Física II' })).toBeInTheDocument()
    expect(within(summary).getByText(/todavía te falta aprobar Física I/)).toBeInTheDocument()
  })

  it('never flags an Equivalencia', async () => {
    const subjects = [
      subject('a', 'Física I', { yearLevel: 1 }),
      subject('b', 'Física II', { yearLevel: 2 }),
    ]
    const store = emptyStore({ subjects, prerequisites: [edge('b', 'a', 'to_pass')] })
    await open(store)
    const user = userEvent.setup()
    await user.click(rowControl('Física II').getByRole('button', { name: /Equivalencia/ }))
    await user.click(screen.getByRole('button', { name: 'Listo' }))
    expect(await screen.findByText(/Todo cierra con el plan/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Para revisar' })).toBeNull()
  })

  it('says everything lines up when nothing contradicts the plan', async () => {
    await open(emptyStore({ subjects: plan() }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(await screen.findByText(/Todo cierra con el plan/)).toBeInTheDocument()
  })

  it('does not offer to approve elective slots', async () => {
    const subjects = [
      subject('a', 'Álgebra', { yearLevel: 1 }),
      subject('e', 'Horas electivas', { yearLevel: 1, elective: true }),
    ]
    const store = emptyStore({ subjects })
    await open(store)
    await userEvent.click(screen.getByRole('button', { name: 'Aprobé todo 1° año' }))
    await waitFor(() => expect(store.states.map((s) => s.curriculumSubjectId)).toEqual(['a']))
  })

  it('invites to choose a carrera when there is none', async () => {
    await renderScreen(
      <ProgressEntryScreen />,
      fakeCampusBackend(emptyStore({ context: null })),
    )
    expect(await screen.findByText('Todavía no elegiste tu carrera')).toBeInTheDocument()
  })
})
