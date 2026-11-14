import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkspaceProvider } from '@/lib/runtime/workspace'
import { Route } from '@/routes/login'

import { renderRoute } from '../helpers/render-route'

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  recovering: false,
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

const submit = async () => {
  await screen.findByRole('group', { name: 'Acción de cuenta' })
  return within(document.querySelector('form')!).getByRole('button', {
    name: /^(Crear cuenta|Entrar|Enviar enlace|Guardar contraseña)$/,
  })
}
const modeButtons = () => screen.getByRole('group', { name: 'Acción de cuenta' })

beforeEach(() => {
  auth.signIn = vi.fn()
  auth.signUp = vi.fn()
  auth.requestPasswordReset = vi.fn()
  auth.updatePassword = vi.fn()
  auth.recovering = false
  change.mockReset()
})

describe('/login', () => {
  it('keeps the recovery form and its email after a service failure', async () => {
    const user = userEvent.setup()
    auth.requestPasswordReset = vi.fn(async () => ({
      error: 'Demasiados intentos. Probá de nuevo en un rato.',
    }))
    mount()
    await user.click(await screen.findByRole('button', { name: 'Iniciar sesión' }))
    await user.click(screen.getByRole('button', { name: 'Recuperar contraseña' }))
    await user.type(screen.getByLabelText(/Email/), 'cursada@example.com')
    await user.click(await submit())
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos')
    expect(screen.getByLabelText(/Email/)).toHaveValue('cursada@example.com')
  })
  it('does not claim a new password was saved when Cloud rejects it', async () => {
    const user = userEvent.setup()
    auth.recovering = true
    auth.updatePassword = vi.fn(async () => ({
      error: 'No pudimos completar la operación. Probá de nuevo.',
    }))
    mount()
    await screen.findByRole('heading', { name: 'Elegí una contraseña nueva.' })
    await user.type(screen.getByLabelText(/Contraseña/), 'nueva-segura-123')
    await user.click(await submit())
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos completar')
    expect(screen.getByLabelText(/Contraseña/)).toHaveValue('nueva-segura-123')
  })
  it('accepts a valid new password only after a recovery session', async () => {
    const user = userEvent.setup()
    auth.recovering = true
    auth.updatePassword = vi.fn(async () => ({ error: null }))
    mount()
    await screen.findByRole('heading', { name: 'Elegí una contraseña nueva.' })
    expect(screen.queryByLabelText(/Email/)).toBeNull()
    await user.type(screen.getByLabelText(/Contraseña/), 'nueva-segura-123')
    await user.click(await submit())
    expect(auth.updatePassword).toHaveBeenCalledWith('nueva-segura-123')
  })
  it('requests a reset using only the email and keeps the response neutral', async () => {
    const user = userEvent.setup()
    auth.requestPasswordReset = vi.fn(async () => ({ error: null }))
    mount()
    await user.click(await screen.findByRole('button', { name: 'Iniciar sesión' }))
    await user.click(screen.getByRole('button', { name: 'Recuperar contraseña' }))
    expect(screen.queryByLabelText(/Contraseña/)).toBeNull()
    await user.type(screen.getByLabelText(/Email/), 'estudiante@unr.edu.ar')
    await user.click(await submit())
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('estudiante@unr.edu.ar')
    expect(auth.signIn).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Si existe una cuenta')
  })
  it('has a way back to the place where the student chooses where to work', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(await screen.findByRole('button', { name: 'Elegir otro espacio' }))

    expect(change).toHaveBeenCalledOnce()
  })

  it('answers an empty submit in Spanish, next to the fields, without the browser bubble', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(await submit())

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
    await user.click(await submit())

    expect(await screen.findByRole('alert')).toHaveTextContent('Campus Cloud no responde ahora')
    expect(auth.signUp).toHaveBeenCalledWith('a@b.com', 'secreto1', '', {
      metricsConsent: false,
    })
  })

  it('switches between register and sign in without misrouting credentials', async () => {
    const user = userEvent.setup()
    auth.signIn = vi.fn(async () => ({ error: 'Email o contraseña incorrectos.' }))
    mount()

    await screen.findByRole('group', { name: 'Acción de cuenta' })
    await user.click(within(modeButtons()).getByRole('button', { name: 'Iniciar sesión' }))
    expect(
      within(modeButtons()).getByRole('button', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByLabelText('¿Cómo te llamás?')).toBeNull()
    await user.type(screen.getByLabelText(/Email/), ' estudiante@unr.edu.ar ')
    await user.type(screen.getByLabelText(/Contraseña/), 'clave123')
    await user.click(await submit())

    expect(auth.signIn).toHaveBeenCalledWith('estudiante@unr.edu.ar', 'clave123')
    expect(auth.signUp).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email o contraseña incorrectos.',
    )

    await user.click(within(modeButtons()).getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('¿Cómo te llamás?')).toBeInTheDocument()
  })

  it('requires real email confirmation before attempting to enter the app', async () => {
    const user = userEvent.setup()
    auth.signUp = vi.fn(async () => ({ error: null, needsConfirmation: true }))
    mount()

    await user.type(await screen.findByRole('textbox', { name: /¿Cómo te llamás/ }), 'Ana')
    await user.type(screen.getByLabelText(/Email/), 'ana@example.com')
    await user.type(screen.getByLabelText(/Contraseña/), 'segura123')
    await user.click(await submit())

    expect(auth.signUp).toHaveBeenCalledWith('ana@example.com', 'segura123', 'Ana', {
      metricsConsent: false,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Confirmalo')
    expect(
      within(modeButtons()).getByRole('button', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/Contraseña/)).toHaveValue('')
  })

  it('offers the metrics box on signup only, unticked', async () => {
    const user = userEvent.setup()
    mount()
    const box = await screen.findByRole('checkbox', {
      name: 'Ayudanos a mejorar: contamos clics, nunca lo que escribís',
    })
    expect(box).not.toBeChecked()

    await user.click(within(modeButtons()).getByRole('button', { name: 'Iniciar sesión' }))
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('sends the consent with the signup when the box is ticked', async () => {
    const user = userEvent.setup()
    auth.signUp = vi.fn(async () => ({ error: null, needsConfirmation: true }))
    mount()

    await user.type(await screen.findByLabelText(/Email/), 'a@b.com')
    await user.type(screen.getByLabelText(/Contraseña/), 'secreto1')
    await user.click(screen.getByRole('checkbox', { name: /Ayudanos a mejorar/ }))
    await user.click(await submit())

    expect(auth.signUp).toHaveBeenCalledWith('a@b.com', 'secreto1', '', {
      metricsConsent: true,
    })
  })
})
