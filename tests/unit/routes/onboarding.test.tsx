import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AcademicContext } from '@/domain/types'
import { RequiresAccountProvider } from '@/lib/runtime/identity'
import { WorkspaceProvider, type WorkspaceValue } from '@/lib/runtime/workspace'
import { Route } from '@/routes/onboarding'

import { renderRoute } from '../helpers/render-route'

const LONG_NAME =
  'Plan de Estudios de la Licenciatura (Resolución C.D. N° 850/2023, Expte. CUDI N° 41043/2023)'

const state = vi.hoisted(() => ({
  existing: null as AcademicContext | null,
  save: vi.fn(),
}))

const some = <T,>(data: T[]) => ({ data, isLoading: false, error: null, refetch: vi.fn() })

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ session: null, loading: false }),
}))
vi.mock('@/features/academic/queries', () => ({
  useInstitutions: () =>
    some([
      { id: 'unr', name: 'Universidad Nacional de Rosario', shortName: 'UNR' },
      { id: 'utn', name: 'Universidad Tecnológica Nacional', shortName: 'UTN' },
    ]),
  useAcademicUnits: (id: string | null) =>
    some(
      id
        ? [
            { id: `${id}-fac`, name: 'Facultad A' },
            { id: `${id}-fac2`, name: 'Facultad B' },
          ]
        : [],
    ),
  usePrograms: (id: string | null) =>
    some(id ? [{ id: `${id}-carrera`, name: 'Carrera' }] : []),
  useCurricula: (id: string | null) =>
    some(
      id
        ? [
            { id: `${id}-plan`, version: 'TO 2024', name: LONG_NAME },
            { id: `${id}-plan2`, version: 'Plan 2019', name: 'Otro' },
          ]
        : [],
    ),
  useAcademicContext: () => ({ data: state.existing }),
  useSaveAcademicContext: () => ({ mutateAsync: state.save, isPending: false, error: null }),
}))

const Onboarding = Route.options.component as () => ReactNode

function mount(
  workspace: WorkspaceValue = { folder: { name: 'Campus', path: '/c' }, change: vi.fn() },
) {
  return renderRoute(() => (
    <RequiresAccountProvider value={false}>
      <WorkspaceProvider value={workspace}>
        <Onboarding />
      </WorkspaceProvider>
    </RequiresAccountProvider>
  ))
}

const steps = () => screen.getByRole('list', { name: 'Pasos' })
const done = () => within(steps()).queryAllByText('(listo)')

beforeEach(() => {
  state.existing = null
  state.save = vi.fn()
})

describe('onboarding: what we cover', () => {
  it('says which universities have plans, before the student picks one', async () => {
    mount()

    expect(
      await screen.findByText('Por ahora tenemos planes de UNR y UTN.'),
    ).toBeInTheDocument()
  })
})

describe('onboarding: the stepper only says what happened', () => {
  it('shows no completed step before anything is chosen', async () => {
    mount()
    await screen.findByRole('list', { name: 'Pasos' })

    expect(done()).toHaveLength(0)
  })

  it('marks a step once the student has chosen it, and not before', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(
      await screen.findByRole('radio', { name: /Universidad Nacional de Rosario/ }),
    )

    const items = within(steps()).getAllByRole('listitem')
    expect(within(items[0]!).getByText('(listo)')).toBeInTheDocument()
    expect(within(items[3]!).queryByText('(listo)')).toBeNull()
  })

  it('has no stepper, and so no green checks, on the "No encuentro mi carrera" path', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(await screen.findByRole('button', { name: 'No encuentro mi carrera' }))

    expect(screen.queryByRole('list', { name: 'Pasos' })).toBeNull()
  })
})

describe('onboarding: the free-text path is honest about where it goes', () => {
  it('says the request is stored only in their folder', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: 'No encuentro mi carrera' }))

    expect(screen.getByText(/queda guardado solo en tu carpeta/i)).toBeInTheDocument()
    expect(screen.queryByText(/Vamos a anotar que nos falta/)).toBeNull()
  })

  it('says "tu cuenta" when the workspace is an account', async () => {
    const user = userEvent.setup()
    mount({ folder: null, change: vi.fn() })
    await user.click(await screen.findByRole('button', { name: 'No encuentro mi carrera' }))

    expect(screen.getByText(/queda guardado solo en tu cuenta/i)).toBeInTheDocument()
  })

  it('uses the same words for the question in the heading and in the field', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: 'No encuentro mi carrera' }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Contanos dónde estudiás.',
    )
    expect(screen.getByLabelText('Carrera y universidad')).toBeInTheDocument()
  })
})

describe('onboarding: revisiting', () => {
  const existing: AcademicContext = {
    id: 'local',
    institutionId: 'unr',
    academicUnitId: 'unr-fac',
    programId: 'unr-fac-carrera',
    curriculumId: 'unr-fac-carrera-plan',
    unmappedLabel: null,
    isActive: true,
  }

  it('preselects the current choice at every step', async () => {
    state.existing = existing
    mount()

    expect(
      await screen.findByRole('radio', { name: /Universidad Nacional de Rosario/ }),
    ).toBeChecked()
    expect(screen.getByRole('radio', { name: /Facultad A/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Carrera/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /TO 2024/ })).toBeChecked()
  })

  it('offers a way back that does not change anything', async () => {
    state.existing = existing
    mount()

    const back = await screen.findByRole('link', { name: 'Volver' })
    expect(back).toHaveAttribute('href', '/settings')
  })

  it('opens the free-text path with what was typed when the carrera was unmapped', async () => {
    state.existing = {
      ...existing,
      institutionId: null,
      curriculumId: null,
      unmappedLabel: 'Psicología — UBA',
    }
    mount()

    expect(await screen.findByLabelText('Carrera y universidad')).toHaveValue(
      'Psicología — UBA',
    )
  })

  it('does not offer "Volver" on the first run: there is nowhere to go back to', async () => {
    mount()
    await screen.findByRole('list', { name: 'Pasos' })

    expect(screen.queryByRole('link', { name: 'Volver' })).toBeNull()
  })
})

describe('onboarding: plan labels', () => {
  it('shows the short plan name and keeps the resolution text collapsed', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(
      await screen.findByRole('radio', { name: /Universidad Nacional de Rosario/ }),
    )
    await user.click(await screen.findByRole('radio', { name: /Facultad A/ }))
    await user.click(await screen.findByRole('radio', { name: /Carrera/ }))

    expect(await screen.findByRole('radio', { name: 'TO 2024' })).toBeInTheDocument()
    const detail = screen.getByText(LONG_NAME).closest('details')!
    expect(detail.open).toBe(false)
    expect(within(detail).getByText('Ver detalle')).toBeInTheDocument()
  })
})
