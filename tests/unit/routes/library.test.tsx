import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Route } from '@/routes/_app/library'

import { renderRoute } from '../helpers/render-route'

const SUBJECT = { id: 'analisis-1', name: 'Análisis Matemático I' }

const state = vi.hoisted(() => ({ create: vi.fn(), reset: vi.fn() }))

vi.mock('@/features/academic/queries', () => ({
  useAcademicPlan: () => ({ views: [SUBJECT], subjectById: new Map([[SUBJECT.id, SUBJECT]]) }),
}))
vi.mock('@/features/items/queries', () => ({
  useResources: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useCreateResource: () => ({
    mutateAsync: state.create,
    reset: state.reset,
    isPending: false,
    error: null,
  }),
  useDeleteResource: () => ({ mutate: vi.fn(), error: null }),
}))

const Library = Route.options.component as () => ReactNode

beforeEach(() => {
  state.create = vi.fn(async () => undefined)
  state.reset = vi.fn()
})

/** Open the dialog from the page header and switch to typing a link by hand. */
async function openLinkDraft() {
  const user = userEvent.setup()
  renderRoute(Library)
  await user.click((await screen.findAllByRole('button', { name: 'Agregar material' }))[0]!)
  const dialog = await screen.findByRole('dialog', { name: 'Agregar material' })
  await user.click(within(dialog).getByRole('button', { name: 'Escribir un link' }))
  return { user, dialog }
}

describe('/library add material', () => {
  it('opens a fresh dialog whose Título and Link share one height', async () => {
    const { dialog } = await openLinkDraft()

    // A previous failed save must not greet the next opening.
    expect(state.reset).toHaveBeenCalledOnce()
    const title = within(dialog).getByRole('textbox', { name: /Título/ })
    const link = within(dialog).getByRole('textbox', { name: /Link/ })
    expect(title.className).toContain('h-10')
    expect(link.className).toContain('h-10')
  })

  it('answers an empty save in Spanish, inline, without the browser bubble', async () => {
    const { user, dialog } = await openLinkDraft()

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(within(dialog).getByText('Poné un título para el material.')).toHaveAttribute(
      'role',
      'alert',
    )
    expect(
      within(dialog).getByText('Ingresá un link que empiece con https:// o http://.'),
    ).toBeInTheDocument()
    expect(state.create).not.toHaveBeenCalled()
    expect(dialog.querySelector('form')).toHaveAttribute('novalidate')
  })

  it('rejects a link that is not a web address', async () => {
    const { user, dialog } = await openLinkDraft()

    await user.type(within(dialog).getByRole('textbox', { name: /Título/ }), 'Apunte')
    await user.type(
      within(dialog).getByRole('textbox', { name: /Link/ }),
      'apunte de la cátedra',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(
      within(dialog).getByText('Ingresá un link que empiece con https:// o http://.'),
    ).toBeInTheDocument()
    expect(state.create).not.toHaveBeenCalled()
  })

  it('files the material under the subject chosen in the dialog, then closes', async () => {
    const { user, dialog } = await openLinkDraft()

    await user.type(within(dialog).getByRole('textbox', { name: /Título/ }), 'Apunte')
    await user.type(
      within(dialog).getByRole('textbox', { name: /Link/ }),
      'https://drive.example/x',
    )
    await user.selectOptions(within(dialog).getByLabelText('Materia'), SUBJECT.name)
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await vi.waitFor(() => expect(state.create).toHaveBeenCalledOnce())
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'link',
        title: 'Apunte',
        url: 'https://drive.example/x',
        curriculumSubjectId: SUBJECT.id,
      }),
    )
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
