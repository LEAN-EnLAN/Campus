import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Route } from '@/routes/_app/settings'
import { RequiresAccountProvider } from '@/lib/runtime/identity'
import { WorkspaceProvider, type WorkspaceValue } from '@/lib/runtime/workspace'
import { ThemeProvider } from '@/lib/theme/theme-context'

import { renderRoute } from '../helpers/render-route'

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ session: null, signOut: vi.fn() }),
}))
const plan = vi.hoisted(() => ({
  value: { hasContext: false } as Record<string, unknown>,
}))
vi.mock('@/features/academic/queries', () => ({
  useAcademicPlan: () => plan.value,
}))

const Settings = Route.options.component as () => ReactNode

function mount(workspace: WorkspaceValue, requiresAccount: boolean) {
  const Screen = () => (
    <ThemeProvider>
      <RequiresAccountProvider value={requiresAccount}>
        <WorkspaceProvider value={workspace}>
          <Settings />
        </WorkspaceProvider>
      </RequiresAccountProvider>
    </ThemeProvider>
  )
  return renderRoute(Screen)
}

const FOLDER = { name: 'Campus', path: '/home/estudiante/Campus' }

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

    expect(await screen.findByText('Campus')).toBeInTheDocument()
    expect(screen.getByText('/home/estudiante/Campus')).toBeInTheDocument()
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
  })
})

describe('accent swatches', () => {
  it('are named by colour, never by hue number', async () => {
    mount({ folder: FOLDER, change: vi.fn() }, false)

    const group = await screen.findByRole('group', { name: 'Color de acento' })
    const names = [...group.querySelectorAll('button')].map((b) => b.textContent?.trim())

    expect(names.length).toBeGreaterThan(1)
    for (const name of names) expect(name).not.toMatch(/\d/)
    expect(new Set(names).size).toBe(names.length)
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
