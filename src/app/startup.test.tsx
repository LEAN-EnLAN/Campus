import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { CampusBackend } from '@/lib/backends/types'
import { RuntimeProvider } from '@/lib/runtime/context'
import { rememberVault, type DeviceConfig, type DeviceStore } from '@/lib/runtime/device-config'
import type { RuntimeCapabilities } from '@/lib/runtime/resolve'
import type { CampusRuntime } from '@/lib/runtime/types'

import { Startup } from './startup'

const VAULT = { path: '/home/estudiante/Campus', name: 'Campus' }

function memoryStore(initial?: DeviceConfig): DeviceStore {
  let value = initial ? JSON.stringify(initial) : null
  return { get: () => value, set: (v) => (value = v) }
}

function mount(over: Partial<RuntimeCapabilities> & { store: DeviceStore }) {
  const caps: RuntimeCapabilities = {
    vaultAvailable: true,
    vaultExists: async () => true,
    openLocal: async (vault) =>
      ({ mode: 'local', vault, backend: {} as CampusBackend }) as CampusRuntime,
    cloudSession: async () => false,
    openCloud: async () => ({ mode: 'cloud', backend: {} as CampusBackend }) as CampusRuntime,
    ...over,
  }
  return render(
    <RuntimeProvider capabilities={caps} fallback={() => <Startup />}>
      <p>app abierta</p>
    </RuntimeProvider>,
  )
}

describe('Startup on a build with a Vault API', () => {
  it('offers this computer and the cloud as two equal choices', async () => {
    mount({ store: memoryStore() })

    expect(await screen.findByRole('heading', { name: 'En esta computadora' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'En la nube' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar o crear cuenta' })).toBeTruthy()
    expect(screen.queryByText(/abrí Campus ahí/)).toBeNull()
  })
})

describe('Startup on a hosted build (no Vault API)', () => {
  it('does not offer a Vault that can only fail', async () => {
    mount({ store: memoryStore(), vaultAvailable: false })

    expect(await screen.findByRole('button', { name: 'Entrar o crear cuenta' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'En esta computadora' })).toBeNull()
    expect(screen.queryByLabelText('Ruta de la carpeta')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Abrir' })).toBeNull()
  })

  it('explains, in one note, where saving on the computer does work', async () => {
    mount({ store: memoryStore(), vaultAvailable: false })

    expect(
      await screen.findByText(/Si querés guardar todo en tu computadora, abrí Campus ahí/),
    ).toBeTruthy()
  })

  it('makes Campus Cloud the primary action', async () => {
    const user = userEvent.setup()
    const openCloud = vi.fn(
      async () => ({ mode: 'cloud', backend: {} as CampusBackend }) as CampusRuntime,
    )
    mount({ store: memoryStore(), vaultAvailable: false, openCloud })

    const button = await screen.findByRole('button', { name: 'Entrar o crear cuenta' })
    // `primary` is the one loud variant (bg-accent); the plain bordered button
    // is what the Vault-first picker uses.
    expect(button.className).toContain('bg-accent')

    await user.click(button)
    expect(await screen.findByText('app abierta')).toBeTruthy()
    expect(openCloud).toHaveBeenCalledOnce()
  })

  it('a device that remembered a vault lands here, not on a broken state', async () => {
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    mount({ store, vaultAvailable: false })

    expect(await screen.findByRole('button', { name: 'Entrar o crear cuenta' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/No pudimos abrir/)).toBeNull()
    expect(screen.queryByText(/No encontramos/)).toBeNull()
    // The remembered vault is not listed as something to click either.
    expect(screen.queryByRole('button', { name: 'Campus' })).toBeNull()
  })
})

describe('Campus Cloud failing to open', () => {
  it('says the service is not answering, not that the connection is bad, and stays on the picker', async () => {
    const user = userEvent.setup()
    mount({
      store: memoryStore(),
      openCloud: async () => {
        throw new Error('Failed to fetch')
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Entrar o crear cuenta' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Campus Cloud no responde ahora')
    expect(alert).not.toHaveTextContent('Revisá tu conexión')
    expect(screen.getByRole('heading', { name: 'En esta computadora' })).toBeTruthy()
  })
})
