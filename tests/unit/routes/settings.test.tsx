import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
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
/** The real route's `beforeLoad`, typed loosely enough to reuse in the test tree. */
const legacyAnchorRedirect = Route.options.beforeLoad as unknown as (ctx: {
  location: { hash: string }
  search: object
}) => void

/** Cloud carries the account capabilities; Local has none of them. */
function fakeBackend(requiresAccount: boolean) {
  let consent = false
  const calls = {
    setMetricsConsent: vi.fn(async (next: boolean) => {
      consent = next
    }),
    deleteAccount: vi.fn(async () => undefined),
  }
  const backend = (requiresAccount
    ? {
        kind: 'cloud',
        profile: {
          get: async () => ({ metricsConsent: consent, metricsConsentAt: null }),
          setMetricsConsent: calls.setMetricsConsent,
        },
        account: { delete: calls.deleteAccount },
      }
    : { kind: 'local' }) as unknown as CampusBackend
  return { backend, calls }
}

/**
 * Ajustes inside a real router with a real `/settings` route — its search
 * validation and its legacy-anchor redirect included — so the sub-navigation's
 * links, `?seccion=` and the back link behave as they do in the app.
 */
function mount(
  workspace: WorkspaceValue,
  requiresAccount: boolean,
  backend: CampusBackend = fakeBackend(requiresAccount).backend,
  path = '/settings',
) {
  window.scrollTo = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <BackendProvider backend={backend}>
          <ThemeProvider>
            <RequiresAccountProvider value={requiresAccount}>
              <WorkspaceProvider value={workspace}>
                <Outlet />
              </WorkspaceProvider>
            </RequiresAccountProvider>
          </ThemeProvider>
        </BackendProvider>
      </QueryClientProvider>
    ),
  })
  const settings = createRoute({
    getParentRoute: () => root,
    path: '/settings',
    validateSearch: Route.options.validateSearch as (s: Record<string, unknown>) => object,
    beforeLoad: ({ location, search }) => legacyAnchorRedirect({ location, search }),
    component: Settings,
  })
  const router = createRouter({
    routeTree: root.addChildren([settings]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
  return router
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
    expect(screen.queryByRole('link', { name: 'Cuenta' })).toBeNull()
    expect(screen.queryByText('Tu cuenta')).toBeNull()
    expect(screen.queryByText('Email')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull()
  })

  it('shows which folder is open, by name and by path', async () => {
    mount(folder(), false, undefined, '/settings?seccion=espacio')

    const section = await screen.findByRole('region', { name: 'Espacio de trabajo' })
    expect(within(section).getByText('En esta computadora')).toBeInTheDocument()
    // Once, in its own row: the old card repeated it in a header block and a 'Nombre' row.
    expect(within(section).getByText('Campus', { exact: true })).toBeInTheDocument()
    expect(within(section).getByText('/home/estudiante/Campus')).toBeInTheDocument()
  })

  it('offers both exports under "Tus datos"', async () => {
    mount(folder(), false, undefined, '/settings?seccion=datos')

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
    mount(folder(change), false, undefined, '/settings?seccion=espacio')

    await user.click(
      await screen.findByRole('button', { name: 'Cambiar de espacio de trabajo' }),
    )

    expect(change).toHaveBeenCalledOnce()
  })

  it('describes local storage without talking about a database', async () => {
    mount(folder(), false, undefined, '/settings?seccion=privacidad')

    await screen.findByRole('heading', { name: 'Ajustes' })
    expect(screen.queryByText(/base de datos/i)).toBeNull()
    expect(screen.getByText(/archivos de tu carpeta/i)).toBeInTheDocument()
  })
})

describe('Ajustes with an account', () => {
  const account: WorkspaceValue = { folder: null, change: vi.fn() }

  it('keeps the account section and still offers to change workspace', async () => {
    const user = userEvent.setup()
    mount(account, true, undefined, '/settings?seccion=cuenta')

    expect(await screen.findByText('Tu cuenta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Espacio de trabajo' }))
    expect(
      await screen.findByRole('button', { name: 'Cambiar de espacio de trabajo' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/no se sincronizan automáticamente/i)).toBeInTheDocument()
  })

  it('shows the actual Cloud email, signs out and redirects only after success', async () => {
    const user = userEvent.setup()
    auth.session = { user: { email: 'estudiante@example.com' } }
    mount(account, true, undefined, '/settings?seccion=cuenta')

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
    mount(account, true, undefined, '/settings?seccion=cuenta')

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cerrar la sesión')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('appearance preferences', () => {
  it('offers Claro / Oscuro / Sistema and four Campus accents, with accessible pressed state', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    mount({ folder: FOLDER, change: vi.fn() }, false, undefined, '/settings?seccion=apariencia')

    const themeGroup = await screen.findByRole('group', { name: 'Tema de la aplicación' })
    const colorGroup = screen.getByRole('group', { name: 'Color de acento' })
    expect(
      within(themeGroup)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Claro', 'Oscuro', 'Sistema'])
    expect(
      within(colorGroup)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Azul Campus', 'Verde', 'Coral', 'Violeta'])
    expect(within(themeGroup).getByRole('button', { name: 'Claro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(colorGroup).getByRole('button', { name: 'Azul Campus' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('applies and remembers the chosen mode and accent through the real ThemeProvider', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const user = userEvent.setup()
    mount({ folder: FOLDER, change: vi.fn() }, false, undefined, '/settings?seccion=apariencia')

    await user.click(await screen.findByRole('button', { name: 'Oscuro' }))
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByRole('button', { name: 'Oscuro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Verde' }))
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-accent', 'verde'),
    )
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('150')
    expect(screen.getByRole('button', { name: 'Verde' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    // No inline accent override: an inline custom property on <html> is what
    // `.campus-blue` used to shadow, leaving the picker inert.
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('')
  })

  it('keeps an older saved preference instead of forcing light', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    localStorage.setItem(ACCENT_STORAGE_KEY, '290')
    mount({ folder: FOLDER, change: vi.fn() }, false)

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
      expect(document.documentElement).toHaveAttribute('data-accent', 'violeta')
    })
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
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

describe('Privacidad', () => {
  const POLICY = [
    /contamos cuántas personas usan Campus por semana/,
    /sin leer el contenido/,
    'El modo Local no mide nada.',
    'No vendemos tus datos.',
    'Datos agregados para universidades: no existe.',
    'Si algún día existe, va a estar apagado y vas a decidir vos.',
  ]

  it('Local: states the policy, with no metrics switch and no account deletion', async () => {
    mount({ folder: FOLDER, change: vi.fn() }, false, undefined, '/settings?seccion=privacidad')

    const section = await screen.findByRole('region', { name: 'Privacidad' })
    for (const line of POLICY) expect(within(section).getByText(line)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Borrar mi cuenta' })).toBeNull()
  })

  it('Cloud: the metrics switch shows the saved choice and changes it', async () => {
    const user = userEvent.setup()
    const { backend, calls } = fakeBackend(true)
    mount({ folder: null, change: vi.fn() }, true, backend, '/settings?seccion=privacidad')

    const section = await screen.findByRole('region', { name: 'Privacidad' })
    for (const line of POLICY) expect(within(section).getByText(line)).toBeInTheDocument()
    const box = within(section).getByRole('checkbox', {
      name: 'Ayudanos a mejorar: contamos clics, nunca lo que escribís',
    })
    await waitFor(() => expect(box).toBeEnabled())
    expect(box).not.toBeChecked()

    await user.click(box)
    expect(calls.setMetricsConsent).toHaveBeenCalledWith(true)
    expect(box).toBeChecked()
  })
})

describe('Borrar mi cuenta', () => {
  beforeEach(() => sessionStorage.clear())

  it('sits next to a visible link to download the data', async () => {
    mount({ folder: null, change: vi.fn() }, true, undefined, '/settings?seccion=cuenta')
    const section = await screen.findByRole('region', { name: 'Borrar mi cuenta' })
    expect(within(section).getByRole('link', { name: 'Descargar mis datos' })).toHaveAttribute(
      'href',
      '/settings?seccion=datos',
    )
  })

  it('deletes only after the student types BORRAR, then signs out', async () => {
    const user = userEvent.setup()
    const { backend, calls } = fakeBackend(true)
    mount({ folder: null, change: vi.fn() }, true, backend, '/settings?seccion=cuenta')

    const section = await screen.findByRole('region', { name: 'Borrar mi cuenta' })
    await user.click(within(section).getByRole('button', { name: 'Borrar mi cuenta' }))

    const dialog = await screen.findByRole('dialog', { name: '¿Borrar tu cuenta?' })
    const confirm = within(dialog).getByRole('button', { name: 'Borrar mi cuenta' })
    expect(confirm).toBeDisabled()

    const field = within(dialog).getByLabelText('Escribí BORRAR para confirmar')
    await user.type(field, 'borrar')
    expect(confirm).toBeDisabled()
    expect(calls.deleteAccount).not.toHaveBeenCalled()

    await user.clear(field)
    await user.type(field, 'BORRAR')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() => expect(auth.signOut).toHaveBeenCalled())
    expect(calls.deleteAccount).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('campus.accountDeleted')).toBe('1')
  })

  it('keeps the session and says so when the deletion fails', async () => {
    const user = userEvent.setup()
    const { backend, calls } = fakeBackend(true)
    calls.deleteAccount.mockRejectedValueOnce(new Error('network'))
    mount({ folder: null, change: vi.fn() }, true, backend, '/settings?seccion=cuenta')

    const section = await screen.findByRole('region', { name: 'Borrar mi cuenta' })
    await user.click(within(section).getByRole('button', { name: 'Borrar mi cuenta' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Borrar tu cuenta?' })
    await user.type(within(dialog).getByLabelText('Escribí BORRAR para confirmar'), 'BORRAR')
    await user.click(within(dialog).getByRole('button', { name: 'Borrar mi cuenta' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'No pudimos borrar tu cuenta',
    )
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('campus.accountDeleted')).toBeNull()
  })
})

describe('section navigation', () => {
  const local = (): WorkspaceValue => ({ folder: FOLDER, change: vi.fn() })

  it('groups the sections under Tu cursada and Cuenta, Carrera open by default', async () => {
    mount({ folder: null, change: vi.fn() }, true)

    const nav = await screen.findByRole('navigation', { name: 'Secciones de ajustes' })
    expect(within(nav).getByRole('list', { name: 'Tu cursada' })).toBeInTheDocument()
    expect(
      within(within(nav).getByRole('list', { name: 'Cuenta' }))
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Espacio de trabajo', 'Privacidad', 'Tus datos', 'Cuenta'])
    expect(within(nav).getByRole('link', { name: 'Carrera' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('region', { name: 'Tu carrera' })).toBeInTheDocument()
    // One section at a time.
    expect(screen.queryByRole('region', { name: 'Apariencia' })).toBeNull()
  })

  it('opens a section from the sub-navigation and puts it in the URL', async () => {
    const user = userEvent.setup()
    const router = mount(local(), false)

    const nav = await screen.findByRole('navigation', { name: 'Secciones de ajustes' })
    await user.click(within(nav).getByRole('link', { name: 'Apariencia' }))

    expect(await screen.findByRole('region', { name: 'Apariencia' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tu carrera' })).toBeNull()
    expect(router.state.location.search).toEqual({ seccion: 'apariencia' })
    expect(within(nav).getByRole('link', { name: 'Apariencia' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Carrera' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('deep-links a section by ?seccion=', async () => {
    mount(local(), false, undefined, '/settings?seccion=asistente')
    expect(await screen.findByRole('region', { name: 'Asistente' })).toBeInTheDocument()
  })

  it('drops an unknown section and shows the default one', async () => {
    mount(local(), false, undefined, '/settings?seccion=nada')
    expect(await screen.findByRole('region', { name: 'Tu carrera' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Carrera' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // On a phone that is the list, not a section with a way back.
    expect(document.querySelector('[data-view]')).toHaveAttribute('data-view', 'list')
  })

  it('does not open Cuenta where there is no account', async () => {
    mount(local(), false, undefined, '/settings?seccion=cuenta')
    expect(await screen.findByRole('region', { name: 'Tu carrera' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tu cuenta' })).toBeNull()
  })

  it.each([
    ['#asistente', 'asistente', 'Asistente'],
    ['#settings-export', 'datos', 'Tus datos'],
  ])('sends the old anchor %s to its section', async (hash, seccion, region) => {
    const router = mount(local(), false, undefined, `/settings${hash}`)
    expect(await screen.findByRole('region', { name: region })).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ seccion })
  })
})

describe('on a phone', () => {
  const local = (): WorkspaceValue => ({ folder: FOLDER, change: vi.fn() })
  const screenRoot = () => document.querySelector('[data-view]')

  it('without a section, the page is the list of all settings, with no back link', async () => {
    mount(local(), false)
    await screen.findByRole('navigation', { name: 'Secciones de ajustes' })
    expect(screenRoot()).toHaveAttribute('data-view', 'list')
    expect(screen.queryByRole('link', { name: 'Todos los ajustes' })).toBeNull()
  })

  it('a picked section carries "Todos los ajustes" back to the list', async () => {
    const user = userEvent.setup()
    const router = mount(local(), false, undefined, '/settings?seccion=privacidad')

    const back = await screen.findByRole('link', { name: 'Todos los ajustes' })
    expect(screenRoot()).toHaveAttribute('data-view', 'section')
    expect(back).toHaveAttribute('href', '/settings')

    await user.click(back)
    await waitFor(() => expect(screenRoot()).toHaveAttribute('data-view', 'list'))
    expect(router.state.location.search).toEqual({})
    expect(screen.queryByRole('link', { name: 'Todos los ajustes' })).toBeNull()
  })
})
