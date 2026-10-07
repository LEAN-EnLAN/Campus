import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkspaceProvider } from '@/lib/runtime/workspace'
import { Route } from '@/routes/login'

import { renderRoute } from '../helpers/render-route'

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ ...auth, session: null, loading: false }),
}))

const Login = Route.options.component as () => ReactNode

const change = vi.fn()
const mount = () =>
  renderRoute(() => (
    <WorkspaceProvider value={{ folder: null, change }}>
      <Login />
    </WorkspaceProvider>
  ))

beforeEach(() => {
  auth.signIn = vi.fn()
  auth.signUp = vi.fn()
  change.mockReset()
})

describe('/login', () => {
  it('has a way back to the place where the student chooses where to work', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(
      await screen.findByRole('button', { name: 'Volver a elegir dónde trabajar' }),
    )

    expect(change).toHaveBeenCalledOnce()
  })

  it('answers an empty submit in Spanish, next to the fields, without the browser bubble', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(await screen.findByRole('button', { name: 'Crear cuenta' }))

    expect(screen.getByText('Escribí tu email.')).toHaveAttribute('role', 'alert')
    expect(
      screen.getByText('La contraseña tiene que tener al menos 6 caracteres.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true')
    expect(auth.signUp).not.toHaveBeenCalled()
    expect(document.querySelector('form')).toHaveAttribute('novalidate')
  })

  it('shows what the service said, not a guess about the connection', async () => {
    const user = userEvent.setup()
    auth.signUp = vi.fn(async () => ({
      error:
        'Campus Cloud no responde ahora. Tu conexión está bien: probá de nuevo en un rato.',
      needsConfirmation: false,
    }))
    mount()

    await user.type(await screen.findByLabelText(/Email/), 'a@b.com')
    await user.type(screen.getByLabelText(/Contraseña/), 'secreto1')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Campus Cloud no responde ahora')
  })
})
