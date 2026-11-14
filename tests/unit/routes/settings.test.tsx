import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BackendProvider } from '@/lib/backends/context'
import type { CampusBackend } from '@/lib/backends/types'
import { Route } from '@/routes/_app/settings'
import { RequiresAccountProvider } from '@/lib/runtime/identity'
import { WorkspaceProvider, type WorkspaceValue } from '@/lib/runtime/workspace'
import { ThemeProvider } from '@/lib/theme/theme-context'
import { ACCENT_STORAGE_KEY, THEME_STORAGE_KEY } from '@/lib/theme/theme'

import { renderRoute } from '../helpers/render-route'

const auth = vi.hoisted(() => ({
  session: null as null | { user: { email: string } },
  signOut: vi.fn(async () => undefined),
}))
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
}))
const plan = vi.hoisted(() => ({
  value: { hasContext: false } as Record<string, unknown>,
}))
vi.mock('@/features/academic/queries', () => ({
  useAcademicPlan: () => plan.value,
}))

const Settings = Route.options.component as () => ReactNode

function mount(workspace: WorkspaceValue, requiresAccount: boolean) {
  // "Tus datos" reads the backend only when a download is asked for.
  const backend = { kind: requiresAccount ? 'cloud' : 'local' } as CampusBackend
  const Screen = () => (
    <BackendProvider backend={backend}>
      <ThemeProvider>
        <RequiresAccountProvider value={requiresAccount}>
          <WorkspaceProvider value={workspace}>
            <Settings />
          </WorkspaceProvider>
        </RequiresAccountProvider>
      </ThemeProvider>
    </BackendProvider>
  )
  return renderRoute(Screen)
}

const FOLDER = { name: 'Campus', path: '/home/estudiante/Campus' }

beforeEach(() => {
  plan.value = { hasContext: false }
  auth.session = null
  auth.signOut = vi.fn(async () => undefined)
  localStorage.removeItem(THEME_STORAGE_KEY)
  localStorage.removeItem(ACCENT_STORAGE_KEY)
})

describe('Ajustes with a local folder', () => {
  const folder = (change = vi.fn()): WorkspaceValue => ({ folder: FOLDER, change })

  it('has no account section, no empty email and no sign-out', async () => {
    mount(folder(), false)

    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
    expect(screen.queryByText('Tu cuenta')).toBeNull()
    expect(screen.queryByText('Email')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull()
  })

  it('shows which folder is open, by name and by path', async () => {
    mount(folder(), false)

    const section = await screen.findByRole('region', { name: 'Espacio de trabajo' })
    expect(within(section).getByText('En esta computadora')).toBeInTheDocument()
    // Once, in its own row: the old card repeated it in a header block and a 'Nombre' row.
    expect(within(section).getByText('Campus', { exact: true })).toBeInTheDocument()
    expect(within(section).getByText('/home/estudiante/Campus')).toBeInTheDocument()
  })

  it('offers both exports under "Tus datos"', async () => {
    mount(folder(), false)

    const section = await screen.findByRole('region', { name: 'Tus datos' })
    expect(
      within(section).getByRole('button', { name: 'Descargar mis datos (JSON)' }),
    ).toBeInTheDocument()
    expect(
      within(section).getByRole('button', { name: 'Mis fechas (.ics)' }),
    ).toBeInTheDocument()
  })

  it('offers to change workspace and hands the student back to the picker', async () => {
    const user = userEvent.setup()
    const change = vi.fn()
    mount(folder(change), false)

    await user.click(
      await screen.findByRole('button', { name: 'Cambiar de espacio de trabajo' }),
    )

    expect(change).toHaveBeenCalledOnce()
  })

  it('describes local storage without talking about a database', async () => {
    mount(folder(), false)

    await screen.findByRole('heading', { name: 'Ajustes' })
    expect(screen.queryByText(/base de datos/i)).toBeNull()
    expect(screen.getByText(/archivos de tu carpeta/i)).toBeInTheDocument()
  })
})

describe('Ajustes with an account', () => {
  const account: WorkspaceValue = { folder: null, change: vi.fn() }

  it('keeps the account section and still offers to change workspace', async () => {
    mount(account, true)

    expect(await screen.findByText('Tu cuenta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cambiar de espacio de trabajo' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/no se sincronizan automáticamente/i)).toBeInTheDocument()
  })

  it('shows the actual Cloud email, signs out and redirects only after success', async () => {
    const user = userEvent.setup()
    auth.session = { user: { email: 'estudiante@example.com' } }
    mount(account, true)

    const section = await screen.findByRole('region', { name: 'Tu cuenta' })
    expect(within(section).getByText('estudiante@example.com')).toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('displays a failure when signOut rejects and allows retry', async () => {
    const user = userEvent.setup()
    auth.signOut = vi
      .fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce(undefined)
    mount(account, true)

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cerrar la sesión')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('blue design preferences', () => {
  it('offers only the supported light and blue choices, with accessible pressed state', async () => {
    mount({ folder: FOLDER, change: vi.fn() }, false)

    const themeGroup = await screen.findByRole('group', { name: 'Tema de la aplicación' })
    const colorGroup = screen.getByRole('group', { name: 'Color de acento' })
    expect(within(themeGroup).getAllByRole('button')).toHaveLength(1)
    expect(within(colorGroup).getAllByRole('button')).toHaveLength(1)
    expect(within(themeGroup).getByRole('button', { name: 'Claro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(colorGroup).getByRole('button', { name: 'Azul Campus' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.queryByRole('button', { name: /Oscuro|Como el sistema|Verde|Rosa|Violeta/ }),
    ).toBeNull()
  })

  it('migrates older device preferences to light/blue using the actual ThemeProvider', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    localStorage.setItem(ACCENT_STORAGE_KEY, '310')
    const user = userEvent.setup()
    mount({ folder: FOLDER, change: vi.fn() }, false)

    await waitFor(() => {
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
      expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('225')
      expect(document.documentElement).toHaveAttribute('data-theme', 'light')
      expect(document.documentElement.style.getPropertyValue('--color-accent')).toMatch(/oklch/)
    })
    await user.click(screen.getByRole('button', { name: 'Claro' }))
    await user.click(screen.getByRole('button', { name: 'Azul Campus' }))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('225')
  })
})

describe('Tu carrera', () => {
  it('shows the short plan name and keeps the full resolution behind "Ver detalle"', async () => {
    plan.value = {
      hasContext: true,
      context: null,
      curriculum: {
        name: 'Plan de Estudios de la Licenciatura (Resolución C.D. N° 850/2023)',
        version: 'TO 2024',
        sourceUrl: null,
      },
    }
    mount({ folder: FOLDER, change: vi.fn() }, false)

    expect(await screen.findByText('TO 2024')).toBeInTheDocument()
    const detail = screen.getByText(/Resolución C.D. N° 850\/2023/).closest('details')!
    expect(detail.open).toBe(false)
  })
})
