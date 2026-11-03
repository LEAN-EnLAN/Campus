import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { subject } from '@/domain/test-fixtures'
import type { Resource } from '@/domain/types'
import type { CampusBackend, CreateResourceInput } from '@/lib/backends/types'

import {
  emptyStore,
  fakeCampusBackend,
  renderScreen,
} from '../../../tests/support/fake-campus-backend'
import { Route as LibraryRoute } from './library'

const Library = LibraryRoute.options.component!

/** The academic fake plus an in-memory resources table. */
function backendWithResources(resources: Resource[] = []) {
  const store = emptyStore({
    subjects: [subject('am1', 'Análisis Matemático I'), subject('ag', 'Álgebra')],
  })
  const backend: CampusBackend = {
    ...fakeCampusBackend(store),
    resources: {
      list: async () => [...resources],
      create: async (input: CreateResourceInput) => {
        const created: Resource = {
          id: `r${resources.length + 1}`,
          curriculumSubjectId: input.curriculumSubjectId,
          kind: input.kind,
          title: input.title,
          url: input.url,
          storagePath: null,
          body: input.body,
          createdAt: '2026-11-03T12:00:00Z',
        }
        resources.push(created)
        return created
      },
      remove: async (id: string) => {
        resources.splice(
          resources.findIndex((r) => r.id === id),
          1,
        )
      },
    },
  }
  return { backend, resources }
}

describe('Material', () => {
  it('adds material through the dialog, filed under the chosen subject', async () => {
    const { backend, resources } = backendWithResources()
    await renderScreen(<Library />, backend)
    const user = userEvent.setup()

    expect(await screen.findByText('Todavía no guardaste nada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar formulario' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Título/ })).not.toBeInTheDocument()

    // The empty state's button opens the same dialog as the header's.
    const [, emptyStateButton] = screen.getAllByRole('button', { name: 'Agregar material' })
    await user.click(emptyStateButton!)
    const dialog = await screen.findByRole('dialog', { name: 'Agregar material' })

    await user.click(within(dialog).getByRole('button', { name: 'Escribir un link' }))
    await user.type(within(dialog).getByRole('textbox', { name: /Título/ }), 'Guía 1')
    await user.type(
      within(dialog).getByRole('textbox', { name: /Link/ }),
      'https://example.com/guia',
    )
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Materia' }),
      'Álgebra',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(resources).toEqual([
      expect.objectContaining({
        kind: 'link',
        title: 'Guía 1',
        url: 'https://example.com/guia',
        curriculumSubjectId: 'ag',
      }),
    ])
    expect(await screen.findByRole('link', { name: 'Guía 1' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Álgebra' })).toBeInTheDocument()
  }, 20_000)

  it('keeps a note without a subject under Sin materia', async () => {
    const { backend, resources } = backendWithResources([
      {
        id: 'r1',
        curriculumSubjectId: 'am1',
        kind: 'link',
        title: 'Apunte',
        url: 'https://example.com/a',
        storagePath: null,
        body: null,
        createdAt: '2026-11-01T12:00:00Z',
      },
    ])
    await renderScreen(<Library />, backend)
    const user = userEvent.setup()

    await screen.findByRole('link', { name: 'Apunte' })
    await user.click(screen.getByRole('button', { name: 'Agregar material' }))
    const dialog = await screen.findByRole('dialog', { name: 'Agregar material' })
    await user.click(within(dialog).getByRole('button', { name: 'Escribir una nota' }))
    await user.type(within(dialog).getByRole('textbox', { name: /Título/ }), 'Consultas')
    expect(within(dialog).getByRole('combobox', { name: 'Materia' })).toHaveDisplayValue(
      'Sin materia',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(resources).toHaveLength(2))
    expect(resources[1]).toMatchObject({ kind: 'note', curriculumSubjectId: null, body: '' })
    expect(await screen.findByRole('heading', { name: /Sin materia/ })).toBeInTheDocument()
  }, 20_000)
})
