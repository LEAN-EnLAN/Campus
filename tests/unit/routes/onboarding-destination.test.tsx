import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RequiresAccountProvider } from '@/lib/runtime/identity'
import { WorkspaceProvider } from '@/lib/runtime/workspace'
import { Route } from '@/routes/onboarding'

/**
 * Where the student lands after saving their carrera. A catalog career has a plan
 * with statuses to mark, so that is the first screen; a manual career has no
 * plan to mark, so it lands on the plan page where they add their materias.
 */

const state = vi.hoisted(() => ({ save: vi.fn() }))

const some = <T,>(data: T[]) => ({ data, isLoading: false, error: null, refetch: vi.fn() })

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ session: null, loading: false }),
}))
vi.mock('@/features/academic/queries', () => ({
  useInstitutions: () =>
    some([{ id: 'unr', name: 'Universidad Nacional de Rosario', shortName: 'UNR' }]),
  useAcademicUnits: (id: string | null) => some(id ? [{ id: 'fac', name: 'Facultad A' }] : []),
  usePrograms: (id: string | null) => some(id ? [{ id: 'carrera', name: 'Carrera' }] : []),
  useCurricula: (id: string | null) =>
    some(id ? [{ id: 'plan', version: 'TO 2024', name: 'Plan' }] : []),
  useAcademicContext: () => ({ data: null }),
  useSaveAcademicContext: () => ({ mutateAsync: state.save, isPending: false, error: null }),
}))

function mount() {
  window.scrollTo = vi.fn()
  const root = createRootRoute()
  const onboarding = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: Route.options.component as () => ReactNode,
  })
  const plan = createRoute({
    getParentRoute: () => root,
    path: '/plan',
    component: () => <p>pantalla del plan</p>,
  })
  const progress = createRoute({
    getParentRoute: () => root,
    path: '/plan/progress',
    component: () => <p>pantalla de progreso</p>,
  })
  const today = createRoute({
    getParentRoute: () => root,
    path: '/today',
    component: () => <p>pantalla de hoy</p>,
  })
  const router = createRouter({
    routeTree: root.addChildren([onboarding, plan, progress, today]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(
    <RequiresAccountProvider value={false}>
      <WorkspaceProvider value={{ folder: { name: 'Campus', path: '/c' }, change: vi.fn() }}>
        <RouterProvider router={router} />
      </WorkspaceProvider>
    </RequiresAccountProvider>,
  )
}

beforeEach(() => {
  state.save = vi.fn(async () => undefined)
})

describe('onboarding: where saving lands', () => {
  it('a catalog career goes to the progress entry', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(await screen.findByRole('radio', { name: /Universidad Nacional/ }))
    // One facultad and one plan are preselected; the carrera is the choice.
    await user.click(await screen.findByRole('radio', { name: /Carrera/ }))
    await user.click(screen.getByRole('button', { name: 'Listo, empezar' }))

    expect(await screen.findByText('pantalla de progreso')).toBeInTheDocument()
  })

  it('a manual career goes to the plan page, where the materias get added', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(await screen.findByRole('button', { name: 'No encuentro mi carrera' }))
    await user.type(screen.getByLabelText('Carrera y universidad'), 'Psicología — UBA')
    await user.click(screen.getByRole('button', { name: 'Listo, empezar' }))

    expect(await screen.findByText('pantalla del plan')).toBeInTheDocument()
  })
})
