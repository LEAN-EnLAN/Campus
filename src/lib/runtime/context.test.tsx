import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { useBackend } from '@/lib/backends/context'
import type { CampusBackend } from '@/lib/backends/types'

import { RuntimeProvider, useRuntime } from './context'
import { rememberVault, type DeviceConfig, type DeviceStore } from './device-config'
import type { RuntimeCapabilities } from './resolve'
import type { CampusRuntime } from './types'

/**
 * LOCAL-004 — both modes reach the SAME component tree.
 *
 * The app below the composition root is rendered by one component in every
 * test here. If it ever needs to know which runtime is active, this file stops
 * compiling, which is the point.
 */

const VAULT = { path: '/home/estudiante/Campus', name: 'Campus' }

function memoryStore(initial?: DeviceConfig): DeviceStore {
  let value = initial ? JSON.stringify(initial) : null
  return { get: () => value, set: (v) => (value = v) }
}

const local = { kind: 'local' } as CampusBackend
const cloud = { kind: 'cloud' } as CampusBackend

function caps(
  over: Partial<RuntimeCapabilities> & { store: DeviceStore },
): RuntimeCapabilities {
  return {
    vaultExists: async () => true,
    openLocal: async (vault) => ({ mode: 'local', vault, backend: local }) as CampusRuntime,
    cloudSession: async () => false,
    openCloud: async () => ({ mode: 'cloud', backend: cloud }) as CampusRuntime,
    ...over,
  }
}

/**
 * The one and only app tree. It asks `useBackend()` and never `useRuntime()`,
 * exactly like every real screen.
 */
function App() {
  const backend = useBackend()
  return <p>backend: {backend.kind}</p>
}

/** The startup surface — the one place allowed to talk about modes. */
function Startup() {
  const { state, chooseVault, chooseCloud, forget, recent } = useRuntime()

  if (state.status === 'resolving') return <p>resolviendo…</p>

  return (
    <div>
      {state.status === 'vault-missing' && (
        <>
          <p>No encontramos este Vault: {state.vault.name}</p>
          <button onClick={() => forget(state.vault.path)}>Quitar de recientes</button>
        </>
      )}
      {state.status === 'needs-choice' && <p>Elegí dónde trabajar</p>}
      <button onClick={() => void chooseVault(VAULT)}>Abrir Vault</button>
      <button onClick={() => void chooseCloud()}>Campus Cloud</button>
      <p>recientes: {recent().length}</p>
    </div>
  )
}

const mount = (capabilities: RuntimeCapabilities) =>
  render(
    <RuntimeProvider capabilities={capabilities} fallback={() => <Startup />}>
      <App />
    </RuntimeProvider>,
  )

describe('choosing a runtime, then remounting', () => {
  it('LOCAL: choose a vault, remount, the backend is still local', async () => {
    const store = memoryStore()
    const user = userEvent.setup()

    const first = mount(caps({ store }))
    await screen.findByText('Elegí dónde trabajar')
    await user.click(screen.getByRole('button', { name: 'Abrir Vault' }))
    expect(await screen.findByText('backend: local')).toBeTruthy()
    first.unmount()

    // A brand new provider over the same device store: this is a restart.
    mount(caps({ store }))
    expect(await screen.findByText('backend: local')).toBeTruthy()
  })

  it('CLOUD: choose Campus Cloud, remount, the backend is still cloud', async () => {
    const store = memoryStore()
    const user = userEvent.setup()

    const first = mount(caps({ store }))
    await screen.findByText('Elegí dónde trabajar')
    await user.click(screen.getByRole('button', { name: 'Campus Cloud' }))
    expect(await screen.findByText('backend: cloud')).toBeTruthy()
    first.unmount()

    mount(caps({ store, cloudSession: async () => true }))
    expect(await screen.findByText('backend: cloud')).toBeTruthy()
  })

  it('both modes render the very same component tree', async () => {
    // `App` above is rendered by both cases and contains no branch on mode.
    // The assertion is structural: the only difference is the string the
    // backend reports about ITSELF, which is diagnostics, not behaviour.
    const user = userEvent.setup()

    const a = mount(caps({ store: memoryStore() }))
    await screen.findByText('Elegí dónde trabajar')
    await user.click(screen.getByRole('button', { name: 'Abrir Vault' }))
    const localTree = a.container.innerHTML
    a.unmount()

    const b = mount(caps({ store: memoryStore() }))
    await screen.findByText('Elegí dónde trabajar')
    await user.click(screen.getByRole('button', { name: 'Campus Cloud' }))
    const cloudTree = b.container.innerHTML

    expect(localTree.replace('local', 'X')).toBe(cloudTree.replace('cloud', 'X'))
  })
})

describe('a remembered vault that is gone', () => {
  const missingCaps = (store: DeviceStore, openLocal = vi.fn()) =>
    caps({ store, vaultExists: async () => false, openLocal, cloudSession: async () => true })

  it('explains itself instead of redirecting to login or creating a folder', async () => {
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    const openLocal = vi.fn()
    mount(missingCaps(store, openLocal))

    expect(await screen.findByText(/No encontramos este Vault: Campus/)).toBeTruthy()
    // Not the first-run screen — the student had a working setup and is owed
    // an explanation that names it.
    expect(screen.queryByText('Elegí dónde trabajar')).toBeNull()
    // Not the cloud, even though a session is valid.
    expect(screen.queryByText('backend: cloud')).toBeNull()
    // And above all, nothing was created where their notes used to be.
    expect(openLocal).not.toHaveBeenCalled()
  })

  it('offers to forget it, and forgetting removes only the entry', async () => {
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    const user = userEvent.setup()
    mount(missingCaps(store))

    await screen.findByText(/No encontramos este Vault/)
    expect(screen.getByText('recientes: 1')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Quitar de recientes' }))
    await waitFor(() => expect(screen.getByText('Elegí dónde trabajar')).toBeTruthy())
    expect(screen.getByText('recientes: 0')).toBeTruthy()
  })

  it('Campus Cloud stays available as a choice, not as a fallback', async () => {
    // The distinction: the student may pick cloud from this screen, but Campus
    // never picks it for them because their folder went missing.
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    const user = userEvent.setup()
    mount(missingCaps(store))

    await screen.findByText(/No encontramos este Vault/)
    await user.click(screen.getByRole('button', { name: 'Campus Cloud' }))
    expect(await screen.findByText('backend: cloud')).toBeTruthy()
  })
})

describe('resolving is not needs-choice', () => {
  it('shows neither the picker nor the app until startup answers', async () => {
    let release: (v: boolean) => void = () => {}
    const pending = new Promise<boolean>((resolve) => (release = resolve))
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))

    mount(caps({ store, vaultExists: () => pending }))

    // Collapsing the two states flashes the picker at a student whose vault is
    // about to open, and teaches them their setup was lost.
    expect(screen.getByText('resolviendo…')).toBeTruthy()
    expect(screen.queryByText('Elegí dónde trabajar')).toBeNull()

    release(true)
    expect(await screen.findByText('backend: local')).toBeTruthy()
  })
})
