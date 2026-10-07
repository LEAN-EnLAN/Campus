import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { ManualSubject } from '@/domain/types'
import { BackendProvider } from '@/lib/backends/context'
import type { AddManualSubjectInput, CampusBackend } from '@/lib/backends/types'

import { AddManualSubjectForm, manualSubjectsBanner } from './manual-subjects'

function renderForm(add: (input: AddManualSubjectInput) => Promise<ManualSubject>) {
  const backend = { academic: { addManualSubject: add } } as unknown as CampusBackend
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <BackendProvider backend={backend}>
        <AddManualSubjectForm />
      </BackendProvider>
    </QueryClientProvider>,
  )
}

const added = (input: AddManualSubjectInput): ManualSubject => ({
  id: 'm1',
  status: null,
  grade: null,
  ...input,
})

describe('AddManualSubjectForm', () => {
  it('adds a subject with name, año and cuatrimestre, then is ready for the next one', async () => {
    const add = vi.fn((input: AddManualSubjectInput) => Promise.resolve(added(input)))
    renderForm(add)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Nombre'), '  Cálculo 1 ')
    await user.selectOptions(screen.getByLabelText('Año'), '2')
    await user.selectOptions(screen.getByLabelText('Cuatrimestre'), '2c')
    await user.click(screen.getByRole('button', { name: 'Agregar materia' }))

    expect(add).toHaveBeenCalledWith({ name: '  Cálculo 1 ', yearLevel: 2, term: '2c' })
    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue(''))
    // The year and term stay: students add a whole year in a row.
    expect(screen.getByLabelText('Año')).toHaveValue('2')
    expect(screen.getByLabelText('Cuatrimestre')).toHaveValue('2c')
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
  })

  it('submits with Enter from the name field', async () => {
    const add = vi.fn((input: AddManualSubjectInput) => Promise.resolve(added(input)))
    renderForm(add)
    await userEvent.type(screen.getByLabelText('Nombre'), 'Física{Enter}')
    expect(add).toHaveBeenCalledTimes(1)
  })

  it('does not call the backend for a blank name, and says what is missing', async () => {
    const add = vi.fn((input: AddManualSubjectInput) => Promise.resolve(added(input)))
    renderForm(add)
    await userEvent.click(screen.getByRole('button', { name: 'Agregar materia' }))
    expect(add).not.toHaveBeenCalled()
    expect(await screen.findByText('Escribí el nombre de la materia.')).toBeInTheDocument()
  })

  it('shows the backend error instead of losing what was typed', async () => {
    renderForm(() => Promise.reject(new Error('No pudimos guardar la materia: sin conexión')))
    await userEvent.type(screen.getByLabelText('Nombre'), 'Física{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('sin conexión')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Física')
  })
})

describe('manualSubjectsBanner', () => {
  it('says plainly what Campus does and does not do for a career it does not have', () => {
    expect(manualSubjectsBanner).toContain('Tu carrera todavía no está en Campus')
    expect(manualSubjectsBanner).toContain('No calculamos correlatividades')
  })
})
