import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { ManualSubject } from '@/domain/types'
import { BackendProvider } from '@/lib/backends/context'
import type {
  AddManualSubjectInput,
  CampusBackend,
  SetSubjectStatusInput,
} from '@/lib/backends/types'

import { AddManualSubjectForm } from './manual-subjects'

function setup(existing: ManualSubject[] = []) {
  let next = 0
  const addManualSubject = vi.fn((input: AddManualSubjectInput): Promise<ManualSubject> =>
    Promise.resolve({ id: `m${++next}`, status: null, grade: null, ...input }),
  )
  const setSubjectStatus = vi.fn((_input: SetSubjectStatusInput) => Promise.resolve())
  const setSubjectStatuses = vi.fn((_inputs: SetSubjectStatusInput[]) => Promise.resolve())
  const backend = {
    academic: {
      addManualSubject,
      setSubjectStatus,
      setSubjectStatuses,
      manualSubjects: () => Promise.resolve(existing),
    },
  } as unknown as CampusBackend
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <BackendProvider backend={backend}>
        <AddManualSubjectForm />
      </BackendProvider>
    </QueryClientProvider>,
  )
  return { addManualSubject, setSubjectStatus, setSubjectStatuses }
}

const existingSubject: ManualSubject = {
  id: 'old',
  name: 'Física I',
  yearLevel: 1,
  term: '1c',
  status: null,
  grade: null,
}

describe('ImportSubjectsDialog', () => {
  it('previews a pasted list, skips duplicates and invalid rows, then imports the rest in order', async () => {
    const user = userEvent.setup()
    const { addManualSubject, setSubjectStatus, setSubjectStatuses } = setup([existingSubject])

    await user.click(screen.getByRole('button', { name: 'Importar materias' }))
    const dialog = await screen.findByRole('dialog', { name: 'Importar materias' })
    expect(dialog).toHaveAccessibleDescription(/no las compara con ningún plan oficial/)

    const list = within(dialog).getByRole('textbox', { name: 'Tu lista' })
    await user.click(list)
    await user.paste(
      'nombre;año;cuatrimestre;estado\nMateria A;1;1c;aprobada\nFISICA I;1\nMateria B;2;;cursando\nMateria C;15\nmateria a;3',
    )

    const table = within(dialog).getByRole('table', { name: 'Vista previa de la importación' })
    await waitFor(() => expect(within(table).getByText('Ya está cargada.')).toBeInTheDocument())
    expect(within(table).getByText('Repetida en la lista.')).toBeInTheDocument()
    expect(within(table).getByText('Elegí un año entre 1 y 10.')).toBeInTheDocument()
    // The invalid row's name points at its reason.
    expect(within(table).getByText('Materia C')).toHaveAccessibleDescription(
      'Elegí un año entre 1 y 10.',
    )
    expect(
      within(dialog).getByText('2 para importar · 1 con errores · 2 repetidas.'),
    ).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Importar 2 materias' }))

    await waitFor(() =>
      expect(within(dialog).getByText('Importamos 2 materias.')).toBeInTheDocument(),
    )
    expect(addManualSubject.mock.calls.map(([input]) => input)).toEqual([
      { name: 'Materia A', yearLevel: 1, term: '1c' },
      // No cuatrimestre in the row: the student's chosen default (Anual).
      { name: 'Materia B', yearLevel: 2, term: 'anual' },
    ])
    // Both statuses go through the existing status mutation, as one batch.
    expect(setSubjectStatus).not.toHaveBeenCalled()
    expect(setSubjectStatuses).toHaveBeenCalledWith([
      { curriculumSubjectId: 'm1', status: 'passed', manual: true },
      { curriculumSubjectId: 'm2', status: 'in_progress', manual: true },
    ])
  })

  it('says how far it got when the backend fails halfway', async () => {
    const user = userEvent.setup()
    const { addManualSubject } = setup()
    addManualSubject
      .mockImplementationOnce((input) =>
        Promise.resolve({ id: 'm1', status: null, grade: null, ...input }),
      )
      .mockImplementationOnce(() => Promise.reject(new Error('sin conexión')))

    await user.click(screen.getByRole('button', { name: 'Importar materias' }))
    const dialog = await screen.findByRole('dialog', { name: 'Importar materias' })
    await user.click(within(dialog).getByRole('textbox', { name: 'Tu lista' }))
    await user.paste('Materia A;1\nMateria B;1\nMateria C;1')
    await user.click(within(dialog).getByRole('button', { name: 'Importar 3 materias' }))

    expect(
      await within(dialog).findByText('Importamos 1 materia. Se cortó: sin conexión'),
    ).toBeInTheDocument()
    expect(addManualSubject).toHaveBeenCalledTimes(2)
  })

  it('reads a JSON file', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Importar materias' }))
    const dialog = await screen.findByRole('dialog', { name: 'Importar materias' })
    const file = new File(
      [JSON.stringify([{ name: 'Materia A', year: 2, term: '2c' }])],
      'lista.json',
      {
        type: 'application/json',
      },
    )
    await user.upload(within(dialog).getByLabelText('Subir archivo'), file)
    expect(await within(dialog).findByText('Materia A')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Importar 1 materia' })).toBeEnabled()
  })

  it('rejects a file that is not CSV or JSON', async () => {
    const user = userEvent.setup({ applyAccept: false })
    setup()
    await user.click(screen.getByRole('button', { name: 'Importar materias' }))
    const dialog = await screen.findByRole('dialog', { name: 'Importar materias' })
    await user.upload(
      within(dialog).getByLabelText('Subir archivo'),
      new File(['x'], 'foto.png', { type: 'image/png' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Elegí un archivo .csv o .json.',
    )
  })
})
