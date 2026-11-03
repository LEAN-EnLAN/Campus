import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AcademicShell } from '@/components/academic-shell'

import { renderRoute } from '../helpers/render-route'

function mount(path: string) {
  const Screen = () => (
    <AcademicShell onQuickCapture={vi.fn()} onSearch={vi.fn()}>
      <p>contenido</p>
    </AcademicShell>
  )
  return renderRoute(Screen, path)
}

const tabBar = () => screen.findByRole('navigation', { name: 'Secciones' })

describe('mobile navigation', () => {
  it('shows four direct tabs and a "Más" tab', async () => {
    mount('/today')
    const bar = await tabBar()

    for (const name of ['Hoy', 'Plan', 'Materias', 'Calendario']) {
      expect(within(bar).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(within(bar).getByRole('button', { name: 'Más' })).toBeInTheDocument()
  })

  it('reaches Notas, Material and Ajustes in two taps', async () => {
    const user = userEvent.setup()
    mount('/today')
    const bar = await tabBar()

    await user.click(within(bar).getByRole('button', { name: 'Más' }))

    const more = await screen.findByRole('navigation', { name: 'Más secciones' })
    for (const name of ['Notas', 'Material', 'Ajustes']) {
      expect(within(more).getByRole('link', { name })).toBeInTheDocument()
    }
  })

  it('closes the extra sections with Escape', async () => {
    const user = userEvent.setup()
    mount('/today')
    await user.click(within(await tabBar()).getByRole('button', { name: 'Más' }))
    await screen.findByRole('navigation', { name: 'Más secciones' })

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('navigation', { name: 'Más secciones' })).toBeNull()
  })

  it('marks "Más" as current while the student is in a section behind it', async () => {
    mount('/settings')

    const more = within(await tabBar()).getByRole('button', { name: 'Más' })
    expect(more).toHaveAttribute('aria-current', 'page')
  })
})

describe('floating add button', () => {
  const fab = () => screen.queryByRole('button', { name: 'Agregar entrega' })

  it('is shown where the page has no add control of its own', async () => {
    mount('/today')
    await tabBar()
    expect(fab()).toBeInTheDocument()
  })

  it.each(['/courses/algebra-12', '/library', '/vault', '/settings'])(
    'is not rendered on %s',
    async (path) => {
      mount(path)
      await tabBar()
      expect(fab()).toBeNull()
    },
  )
})

describe('top bar', () => {
  it('has no notifications control and no avatar link to Settings', async () => {
    mount('/today')
    await tabBar()
    expect(screen.queryByRole('link', { name: /notificaciones/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /notificaciones/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /ajustes de cuenta/i })).toBeNull()
  })

  it('renders the account menu trigger only when the layout hands it an account', async () => {
    const Screen = () => (
      <AcademicShell
        onQuickCapture={vi.fn()}
        onSearch={vi.fn()}
        account={{
          identity: { kind: 'local', folderName: 'Facultad' },
          onChangeWorkspace: vi.fn(),
        }}
      >
        <p>contenido</p>
      </AcademicShell>
    )
    renderRoute(Screen, '/today')
    const triggers = await screen.findAllByRole('button', {
      name: 'Espacio de trabajo: Facultad',
    })
    // One on the desktop bar, one on the mobile bar; CSS shows one per viewport.
    expect(triggers).toHaveLength(2)
    for (const trigger of triggers) expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  })
})
