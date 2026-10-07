import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { CampusBackend } from '@/lib/backends/types'
import { RuntimeProvider } from '@/lib/runtime/context'
import { rememberVault, type DeviceConfig, type DeviceStore } from '@/lib/runtime/device-config'
import type { RuntimeCapabilities } from '@/lib/runtime/resolve'
import type { CampusRuntime } from '@/lib/runtime/types'
import { VaultError } from '@/lib/vault/errors'
import type { FolderListing } from '@/lib/vault/http-vault-access'

import { Startup } from './startup'

/**
 * The first screen. Two equal choices named by what the student wants (keep it
 * on this computer / in the cloud), no unexplained jargon, a folder that is one
 * click away, and the folder picker as the way to choose another one. Typing a
 * path stays, as the shortcut.
 */

const HOME = '/home/ana'
const LISTINGS: Record<string, FolderListing> = {
  [HOME]: { path: HOME, parent: null, dirs: ['Documents', 'Facultad'] },
  [`${HOME}/Facultad`]: { path: `${HOME}/Facultad`, parent: HOME, dirs: [] },
}

function memoryStore(initial?: DeviceConfig): DeviceStore {
  let value = initial ? JSON.stringify(initial) : null
  return { get: () => value, set: (v) => (value = v) }
}

const opened = () =>
  vi.fn(
    async (vault) => ({ mode: 'local', vault, backend: {} as CampusBackend }) as CampusRuntime,
  )

function mount(over: Partial<RuntimeCapabilities> = {}) {
  const caps: RuntimeCapabilities = {
    vaultAvailable: true,
    store: memoryStore(),
    vaultExists: async () => true,
    openLocal: opened(),
    cloudSession: async () => false,
    openCloud: async () => ({ mode: 'cloud', backend: {} as CampusBackend }) as CampusRuntime,
    listFolders: async (path) => LISTINGS[path ?? HOME]!,
    ...over,
  }
  render(
    <RuntimeProvider capabilities={caps} fallback={() => <Startup />}>
      <p>app abierta</p>
    </RuntimeProvider>,
  )
  return caps
}

describe('the first screen', () => {
  it('asks one plain question and puts two equal choices under it', async () => {
    mount()

    expect(
      await screen.findByText('¿Dónde querés guardar tus materias y tus notas?'),
    ).toBeInTheDocument()
    const local = screen.getByRole('region', { name: 'En esta computadora' })
    const cloud = screen.getByRole('region', { name: 'En la nube' })
    expect(local).toHaveTextContent('Funciona sin internet y no necesitás cuenta')
    expect(cloud).toHaveTextContent('Necesitás un mail y una contraseña')
  })

  it('does not say Vault, plan B or guest anywhere', async () => {
    mount()
    await screen.findByRole('region', { name: 'En esta computadora' })

    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/Vault/i)
    expect(text).not.toMatch(/invitado/i)
  })

  it('says the notes are plain files they can take with them', async () => {
    mount()

    expect(
      await screen.findByText(
        'Tus notas son archivos de texto: te los podés llevar cuando quieras.',
      ),
    ).toBeInTheDocument()
  })

  it('suggests a folder inside Documents and uses it in one click, creating it if needed', async () => {
    const user = userEvent.setup()
    const caps = mount()

    const local = await screen.findByRole('region', { name: 'En esta computadora' })
    expect(await within(local).findByText('Documents/Campus')).toBeInTheDocument()
    expect(local).toHaveTextContent('Si no existe, la creamos')

    await user.click(within(local).getByRole('button', { name: 'Usar esta carpeta' }))

    expect(caps.openLocal).toHaveBeenCalledWith(
      { path: `${HOME}/Documents/Campus`, name: 'Campus' },
      { create: true },
    )
    expect(await screen.findByText('app abierta')).toBeInTheDocument()
  })

  it('falls back to a Campus folder at home when there is no Documents', async () => {
    mount({
      listFolders: async () => ({ path: HOME, parent: null, dirs: ['Facultad'] }),
    })

    const local = await screen.findByRole('region', { name: 'En esta computadora' })
    expect(await within(local).findByText('Campus')).toBeInTheDocument()
  })

  it('chooses another folder with the picker, and opens it without creating anything', async () => {
    const user = userEvent.setup()
    const caps = mount()

    await user.click(await screen.findByRole('button', { name: 'Elegir otra carpeta…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Elegir carpeta' })
    await user.dblClick(await within(dialog).findByRole('option', { name: 'Facultad' }))
    await within(dialog).findByText(/No hay carpetas acá adentro/)
    await user.click(within(dialog).getByRole('button', { name: 'Usar esta carpeta' }))

    expect(caps.openLocal).toHaveBeenCalledWith(
      { path: `${HOME}/Facultad`, name: 'Facultad' },
      undefined,
    )
    expect(await screen.findByText('app abierta')).toBeInTheDocument()
  })

  it('closing the picker changes nothing', async () => {
    const user = userEvent.setup()
    const caps = mount()

    await user.click(await screen.findByRole('button', { name: 'Elegir otra carpeta…' }))
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(caps.openLocal).not.toHaveBeenCalled()
  })

  it('keeps typing a path as a shortcut, hidden until asked for', async () => {
    const user = userEvent.setup()
    const caps = mount()

    await screen.findByRole('button', { name: 'Elegir otra carpeta…' })
    expect(screen.queryByRole('textbox', { name: 'Ruta de la carpeta' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Escribir la ruta a mano' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Ruta de la carpeta' }),
      '/home/ana/Facultad{Enter}',
    )

    expect(caps.openLocal).toHaveBeenCalledWith(
      { path: '/home/ana/Facultad', name: 'Facultad' },
      undefined,
    )
  })

  it('shows a refusal of the suggested folder in Spanish, under the buttons', async () => {
    const user = userEvent.setup()
    mount({
      openLocal: vi.fn(async () => {
        throw new VaultError('permission_denied', 'denied')
      }),
    })

    await user.click(await screen.findByRole('button', { name: 'Usar esta carpeta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Campus no tiene permiso para hacer eso en esa carpeta.',
    )
  })

  it('without a folder service it is just the typed path, open from the start', async () => {
    mount({ listFolders: undefined })

    expect(
      await screen.findByRole('textbox', { name: 'Ruta de la carpeta' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Elegir otra carpeta…' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Usar esta carpeta' })).toBeNull()
  })

  it('puts a remembered folder above the choices, to continue with', async () => {
    const store = memoryStore(
      rememberVault(
        { recentVaults: [], lastRuntime: null },
        { path: '/home/ana/Otra', name: 'Otra' },
      ),
    )
    // A remembered folder that opens would skip this screen; one the student
    // left on purpose (changeWorkspace) shows it.
    const left = JSON.parse(store.get()!) as DeviceConfig
    store.set(JSON.stringify({ ...left, lastRuntime: null }))
    mount({ store })

    const recent = await screen.findByRole('region', { name: 'Recientes' })
    expect(within(recent).getByRole('button', { name: 'Otra' })).toBeInTheDocument()
  })

  it('names the cloud button for what it does, and an unreachable cloud stays honest', async () => {
    const user = userEvent.setup()
    mount({
      openCloud: async () => {
        throw new Error('Failed to fetch')
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Entrar o crear cuenta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Campus Cloud no responde ahora')
  })
})
