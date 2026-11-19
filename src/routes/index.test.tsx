import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Route as IndexRoute } from './index'

const auth = vi.hoisted(() => ({ session: null as object | null, loading: false }))
const runtime = vi.hoisted(() => ({ vaultAvailable: true }))
vi.mock('@/features/auth/auth-context', () => ({ useAuth: () => auth }))
vi.mock('@/lib/runtime/context', () => ({ useRuntime: () => runtime }))

afterEach(() => {
  auth.session = null
  auth.loading = false
  runtime.vaultAvailable = true
})

function mountAt(path: string) {
  const root = createRootRoute({ component: () => <Outlet /> })
  const index = IndexRoute.update({
    id: '/',
    path: '/',
    getParentRoute: () => root,
  } as never)
  const today = createRoute({
    getParentRoute: () => root,
    path: '/today',
    component: () => <h1>Hoy</h1>,
  })
  const router = createRouter({
    routeTree: root.addChildren([index, today]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

describe('/', () => {
  it('opens Hoy in the desktop app and local builds', async () => {
    runtime.vaultAvailable = true
    const router = mountAt('/')
    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/today')
  })

  it('opens Hoy for a signed-in student of the hosted build', async () => {
    runtime.vaultAvailable = false
    auth.session = { user: { id: 'u1' } }
    const router = mountAt('/')
    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/today')
  })

  it('shows the landing to a visitor of the hosted build', async () => {
    runtime.vaultAvailable = false
    mountAt('/')
    expect(
      await screen.findByRole(
        'heading',
        {
          level: 1,
          name: /tu plan de estudios, convertido en qué hacer hoy/i,
        },
        // The landing is a lazy chunk; the first import in a cold run is slow.
        { timeout: 15000 },
      ),
    ).toBeInTheDocument()
    const demo = screen.getAllByRole('link', { name: /probar la demo/i })
    expect(demo[0]).toHaveAttribute('href', '/demo')
    expect(screen.getAllByRole('link', { name: /crear cuenta gratis/i })[0]).toHaveAttribute(
      'href',
      '/login',
    )
    expect(screen.getAllByRole('link', { name: /descargar para windows/i })[0]).toHaveAttribute(
      'href',
      'https://github.com/LEAN-EnLAN/Campus/releases',
    )
    expect(document.title).toMatch(/qué hacer hoy/)
  })

  it('labels the progress numbers as an example, not as anyone’s data', async () => {
    runtime.vaultAvailable = false
    mountAt('/')
    await screen.findByRole('heading', { level: 1 }, { timeout: 15000 })
    expect(screen.getAllByText('Ejemplo').length).toBeGreaterThan(0)
  })

  it('shows nothing while the session check is still running', async () => {
    runtime.vaultAvailable = false
    auth.loading = true
    const router = mountAt('/')
    await router.load()
    expect(screen.queryByRole('heading')).toBeNull()
    expect(router.state.location.pathname).toBe('/')
  })
})
