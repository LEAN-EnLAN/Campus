import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Route } from '@/routes/_app/library'

import { renderRoute } from '../helpers/render-route'

const state = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('@/features/academic/queries', () => ({
  useAcademicPlan: () => ({ views: [], subjectById: new Map() }),
}))
vi.mock('@/features/items/queries', () => ({
  useResources: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useCreateResource: () => ({ mutateAsync: state.create, isPending: false, error: null }),
  useDeleteResource: () => ({ mutate: vi.fn(), error: null }),
}))

const Library = Route.options.component as () => ReactNode

beforeEach(() => {
  state.create = vi.fn(async () => undefined)
})

describe('/library form', () => {
  it('keeps Título and Link the same height', async () => {
    renderRoute(Library)

    const title = await screen.findByLabelText(/Título/)
    const link = screen.getByLabelText(/Link/, { selector: 'input' })
    expect(link.className).toContain('h-10')
    expect(title.className).toContain('h-10')
  })

  it('answers an empty save in Spanish, inline, without the browser bubble', async () => {
    const user = userEvent.setup()
    renderRoute(Library)

    await user.click(await screen.findByRole('button', { name: 'Guardar' }))

    expect(screen.getByText('Poné un título.')).toHaveAttribute('role', 'alert')
    expect(screen.getByText('Pegá el link.')).toBeInTheDocument()
    expect(state.create).not.toHaveBeenCalled()
    expect(document.querySelector('form')).toHaveAttribute('novalidate')
  })

  it('rejects a link that is not a web address', async () => {
    const user = userEvent.setup()
    renderRoute(Library)

    await user.type(await screen.findByLabelText(/Título/), 'Apunte')
    await user.type(
      screen.getByLabelText(/Link/, { selector: 'input' }),
      'apunte de la cátedra',
    )
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      screen.getByText('El link tiene que empezar con http:// o https://.'),
    ).toBeInTheDocument()
    expect(state.create).not.toHaveBeenCalled()
  })

  it('returns focus to Título after saving, ready for the next one', async () => {
    const user = userEvent.setup()
    renderRoute(Library)

    await user.type(await screen.findByLabelText(/Título/), 'Apunte')
    await user.type(
      screen.getByLabelText(/Link/, { selector: 'input' }),
      'https://drive.example/x',
    )
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await vi.waitFor(() => expect(state.create).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(screen.getByLabelText(/Título/)).toHaveFocus())
  })
})
