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
  singleUnit: false,
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
            ...(state.singleUnit ? [] : [{ id: `${id}-fac2`, name: 'Facultad B' }]),
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
  path = '/',
) {
  return renderRoute(
    () => (
      <RequiresAccountProvider value={false}>
        <WorkspaceProvider value={workspace}>
          <Onboarding />
        </WorkspaceProvider>
      </RequiresAccountProvider>
    ),
    path,
  )
}

const steps = () => screen.getByRole('navigation', { name: 'Pasos de configuración' })
const stepButtons = () => within(steps()).getAllByRole('button')
const done = () =>
  stepButtons().filter((button) => button.getAttribute('data-complete') === 'true')

beforeEach(() => {
  state.existing = null
  state.save = vi.fn(async () => undefined)
  state.singleUnit = false
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
    await screen.findByRole('navigation', { name: 'Pasos de configuración' })

    expect(done()).toHaveLength(0)
    expect(stepButtons()[0]).toHaveAttribute('aria-current', 'step')
    expect(stepButtons()[1]).toBeDisabled()
    expect(stepButtons()[2]).toBeDisabled()
    expect(stepButtons()[3]).toBeDisabled()
  })

  it('marks a step once the student has chosen it, and not before', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(
      await screen.findByRole('radio', { name: /Universidad Nacional de Rosario/ }),
    )

    expect(done()).toHaveLength(1)
    expect(stepButtons()[0]).toHaveAttribute('data-complete', 'true')
    expect(stepButtons()[1]).toHaveAttribute('aria-current', 'step')
    expect(stepButtons()[3]).toHaveAttribute('data-complete', 'false')
  })

  it('has no stepper, and so no green checks, on the "No encuentro mi carrera" path', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(await screen.findByRole('button', { name: 'No encuentro mi carrera' }))

    expect(screen.queryByRole('navigation', { name: 'Pasos de configuración' })).toBeNull()
    expect(state.save).not.toHaveBeenCalled()
  })

  it('advances from a sole faculty already preselected, with accessible step buttons', async () => {
    const user = userEvent.setup()
    state.singleUnit = true
    mount()

    await user.click(
      await screen.findByRole('radio', { name: /Universidad Nacional de Rosario/ }),
    )
    expect(await screen.findByRole('radio', { name: 'Facultad A' })).toBeChecked()
    expect(stepButtons()[1]).toHaveAttribute('aria-current', 'step')
    expect(stepButtons()[2]).toBeEnabled()

    // Clicking a prechecked radio must still progress to the real career options.
    await user.click(screen.getByRole('radio', { name: 'Facultad A' }))
    expect(await screen.findByRole('radio', { name: 'Carrera' })).toBeInTheDocument()
    expect(stepButtons()[2]).toHaveAttribute('aria-current', 'step')

    await user.click(stepButtons()[0]!)
    expect(screen.getByRole('radio', { name: /Universidad Nacional de Rosario/ })).toBeChecked()
    expect(stepButtons()[0]).toHaveAttribute('aria-current', 'step')
  })
})

describe('onboarding: "Siguiente"', () => {
  const next = () => screen.queryByRole('button', { name: 'Siguiente' })

  it('continues from a step that pre-selected its only option, without the stepper', async () => {
    const user = userEvent.setup()
    state.singleUnit = true
    mount()

    await user.click(
      await screen.findByRole('radio', { name: /Universidad Nacional de Rosario/ }),
    )
    expect(await screen.findByRole('radio', { name: 'Facultad A' })).toBeChecked()

    await user.click(next()!)
    expect(await screen.findByRole('radio', { name: 'Carrera' })).toBeInTheDocument()
    expect(stepButtons()[2]).toHaveAttribute('aria-current', 'step')
  })

  it('is disabled until the step has a selection', async () => {
    mount()
    await screen.findByRole('radio', { name: /Universidad Nacional de Rosario/ })

    expect(next()).toBeDisabled()
  })

  it('is on every step but the last, which keeps "Guardar y continuar"', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(
      await screen.findByRole('radio', { name: /Universidad Nacional de Rosario/ }),
    )
    await user.click(await screen.findByRole('radio', { name: 'Facultad A' }))
    expect(next()).toBeInTheDocument()
    await user.click(await screen.findByRole('radio', { name: 'Carrera' }))

    expect(stepButtons()[3]).toHaveAttribute('aria-current', 'step')
    expect(next()).toBeNull()
    expect(screen.getByRole('button', { name: 'Guardar y continuar' })).toBeInTheDocument()
  })

  it('goes back and forward over choices already made', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(
      await screen.findByRole('radio', { name: /Universidad Nacional de Rosario/ }),
    )
    await user.click(screen.getByRole('button', { name: /Anterior/ }))
    expect(stepButtons()[0]).toHaveAttribute('aria-current', 'step')

    await user.click(next()!)
    expect(stepButtons()[1]).toHaveAttribute('aria-current', 'step')
    // Facultad not chosen yet: nothing to continue with.
    expect(next()).toBeDisabled()
  })

  it('is not offered on the free-text path', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(await screen.findByRole('button', { name: 'No encuentro mi carrera' }))
    expect(next()).toBeNull()
  })
})

describe('onboarding: the free-text path is honest about where it goes', () => {
  it('says the request is stored only in their folder', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: 'No encuentro mi carrera' }))

    expect(screen.getByText(/se guarda en tu carpeta/i)).toBeInTheDocument()
    expect(screen.queryByText(/Vamos a anotar que nos falta/)).toBeNull()
  })

  it('says "tu cuenta" when the workspace is an account', async () => {
    const user = userEvent.setup()
    mount({ folder: null, change: vi.fn() })
    await user.click(await screen.findByRole('button', { name: 'No encuentro mi carrera' }))

    expect(screen.getByText(/se guarda en tu cuenta/i)).toBeInTheDocument()
  })

  it('uses the same words for the question in the heading and in the field', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: 'No encuentro mi carrera' }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Empezá con tu propia carrera.',
    )
    expect(screen.getByRole('textbox', { name: /Carrera y universidad/ })).toBeInTheDocument()
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
    const user = userEvent.setup()
    state.existing = existing
    mount()

    expect(await screen.findByRole('radio', { name: 'TO 2024' })).toBeChecked()
    expect(done()).toHaveLength(4)
    await user.click(stepButtons()[0]!)
    expect(screen.getByRole('radio', { name: /Universidad Nacional de Rosario/ })).toBeChecked()
    await user.click(stepButtons()[1]!)
    expect(screen.getByRole('radio', { name: /Facultad A/ })).toBeChecked()
    await user.click(stepButtons()[2]!)
    expect(screen.getByRole('radio', { name: 'Carrera' })).toBeChecked()
    await user.click(stepButtons()[3]!)
    expect(screen.getByRole('radio', { name: 'TO 2024' })).toBeChecked()
  })

  it('offers a way back to Ajustes when it was opened from Ajustes', async () => {
    state.existing = existing
    mount(undefined, '/?from=settings')

    const back = await screen.findByRole('link', { name: 'Volver a ajustes' })
    expect(back).toHaveAttribute('href', '/settings')
  })

  it('offers Hoy, not Ajustes, when it was opened from anywhere else', async () => {
    state.existing = existing
    mount()

    const out = await screen.findByRole('link', { name: 'Ir a Hoy' })
    expect(out).toHaveAttribute('href', '/today')
    expect(screen.queryByRole('link', { name: 'Volver a ajustes' })).toBeNull()
  })

  it('opens the free-text path with what was typed when the carrera was unmapped', async () => {
    state.existing = {
      ...existing,
      institutionId: null,
      curriculumId: null,
      unmappedLabel: 'Psicología — UBA',
    }
    mount()

    expect(await screen.findByRole('textbox', { name: /Carrera y universidad/ })).toHaveValue(
      'Psicología — UBA',
    )
  })

  // QA: a brand-new student who had never seen Ajustes was offered "Volver a ajustes".
  it('sends a first-run student who just saved their plan to Hoy, never "back" to Ajustes', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(
      await screen.findByRole('radio', { name: /Universidad Nacional de Rosario/ }),
    )
    await user.click(await screen.findByRole('radio', { name: 'Facultad A' }))
    await user.click(await screen.findByRole('radio', { name: 'Carrera' }))
    await user.click(await screen.findByRole('radio', { name: 'TO 2024' }))
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    expect(await screen.findByText('Tu plan ya está en Campus.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Hoy' })).toHaveAttribute('href', '/today')
    expect(screen.queryByRole('link', { name: 'Volver a ajustes' })).toBeNull()
  })

  it('does not offer "Volver" on the first run: there is nowhere to go back to', async () => {
    mount()
    await screen.findByRole('navigation', { name: 'Pasos de configuración' })

    expect(screen.queryByRole('link', { name: 'Volver a ajustes' })).toBeNull()
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

describe('onboarding: real decisions and workspace', () => {
  it('does not allow an incomplete selection to be saved and clears downstream choices on university change', async () => {
    const user = userEvent.setup()
    mount()

    expect(screen.queryByRole('button', { name: 'Guardar y continuar' })).toBeNull()
    await user.click(
      await screen.findByRole('radio', { name: /Universidad Nacional de Rosario/ }),
    )
    await user.click(screen.getByRole('radio', { name: 'Facultad A' }))
    await user.click(screen.getByRole('radio', { name: 'Carrera' }))
    await user.click(screen.getByRole('radio', { name: 'TO 2024' }))
    expect(screen.getByRole('button', { name: 'Guardar y continuar' })).toBeEnabled()

    await user.click(stepButtons()[0]!)
    await user.click(screen.getByRole('radio', { name: /Universidad Tecnológica Nacional/ }))
    expect(done()).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Guardar y continuar' })).toBeNull()
    expect(state.save).not.toHaveBeenCalled()
  })

  it('can return to workspace selection without saving an academic context', async () => {
    const user = userEvent.setup()
    const change = vi.fn()
    mount({ folder: { name: 'Mi carpeta', path: '/campus' }, change })

    expect(
      await screen.findByRole('complementary', { name: 'Espacio y resumen' }),
    ).toHaveTextContent('En esta computadora: Mi carpeta')
    await user.click(await screen.findByRole('button', { name: 'Cambiar espacio de trabajo' }))
    expect(change).toHaveBeenCalledOnce()
    expect(state.save).not.toHaveBeenCalled()
  })
})
