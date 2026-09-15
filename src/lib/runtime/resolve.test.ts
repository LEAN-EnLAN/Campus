import { describe, expect, it, vi } from 'vitest'

import type { CampusBackend } from '@/lib/backends/types'

import {
  forgetVault,
  rememberCloud,
  rememberVault,
  readDeviceConfig,
  writeDeviceConfig,
  type DeviceConfig,
  type DeviceStore,
} from './device-config'
import { descriptorFor, resolveCampusRuntime, type RuntimeCapabilities } from './resolve'
import type { CampusRuntime } from './types'

/** An in-memory device store. Device preferences, not the student's work. */
function memoryStore(initial?: DeviceConfig): DeviceStore {
  let value = initial ? JSON.stringify(initial) : null
  return { get: () => value, set: (v) => (value = v) }
}

const localBackend = { kind: 'local' } as CampusBackend
const cloudBackend = { kind: 'cloud' } as CampusBackend

function caps(
  over: Partial<RuntimeCapabilities> & { store: DeviceStore },
): RuntimeCapabilities {
  return {
    vaultExists: async () => true,
    openLocal: async (vault) =>
      ({ mode: 'local', vault, backend: localBackend }) as CampusRuntime,
    cloudSession: async () => false,
    openCloud: async () => ({ mode: 'cloud', backend: cloudBackend }) as CampusRuntime,
    ...over,
  }
}

const VAULT = { path: '/home/estudiante/Campus', name: 'Campus' }

describe('resolveCampusRuntime — startup is explicit, not implicit auth', () => {
  it('nothing configured is its own answer, not a login redirect', async () => {
    const state = await resolveCampusRuntime(caps({ store: memoryStore() }))
    // The old rule was "no session → login". A student with a folder and no
    // account is a first-class user, so absence of a session decides nothing.
    expect(state.status).toBe('needs-choice')
  })

  it('reopens the last vault', async () => {
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    const state = await resolveCampusRuntime(caps({ store }))
    expect(state.status).toBe('ready')
    if (state.status === 'ready') {
      expect(state.runtime.mode).toBe('local')
      if (state.runtime.mode === 'local') expect(state.runtime.vault.path).toBe(VAULT.path)
    }
  })

  it('reopens a cloud session', async () => {
    const store = memoryStore(rememberCloud({ recentVaults: [], lastRuntime: null }))
    const state = await resolveCampusRuntime(caps({ store, cloudSession: async () => true }))
    expect(state.status).toBe('ready')
    if (state.status === 'ready') expect(state.runtime.mode).toBe('cloud')
  })

  it('prefers the vault over a still-valid cloud session', async () => {
    // Reopening the cloud because a token happened to be fresh would move a
    // student off their own files without asking.
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    const state = await resolveCampusRuntime(caps({ store, cloudSession: async () => true }))
    expect(state.status).toBe('ready')
    if (state.status === 'ready') expect(state.runtime.mode).toBe('local')
  })

  it('an expired cloud session asks again rather than assuming', async () => {
    const store = memoryStore(rememberCloud({ recentVaults: [], lastRuntime: null }))
    const state = await resolveCampusRuntime(caps({ store, cloudSession: async () => false }))
    expect(state.status).toBe('needs-choice')
  })
})

describe('a missing vault is a problem to explain, not a state to erase', () => {
  const missing = () => {
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    return { store, openLocal: vi.fn(), vaultExists: async () => false }
  }

  it('reports vault-missing, distinct from needs-choice', async () => {
    const state = await resolveCampusRuntime(caps(missing()))
    expect(state.status).toBe('vault-missing')
    if (state.status === 'vault-missing') expect(state.vault.path).toBe(VAULT.path)
  })

  it('does NOT fall back to cloud, even when a session is valid', async () => {
    const state = await resolveCampusRuntime(
      caps({ ...missing(), cloudSession: async () => true }),
    )
    // Falling through to cloud would show the student an empty Campus and let
    // them conclude their work is gone.
    expect(state.status).toBe('vault-missing')
  })

  it('does NOT open or create anything', async () => {
    const m = missing()
    await resolveCampusRuntime(caps(m))
    // Silently recreating the folder is the worst available behaviour: it
    // manufactures an empty vault exactly where the student's notes used to be.
    expect(m.openLocal).not.toHaveBeenCalled()
  })

  it('keeps the entry until the student decides — resolution never forgets it', async () => {
    const m = missing()
    await resolveCampusRuntime(caps(m))
    const after = readDeviceConfig(m.store)
    expect(after.lastRuntime).toEqual({ mode: 'local', path: VAULT.path })
    // Forgetting is an action the student takes from the picker, so the
    // explanation can name the vault it is talking about.
    expect(after.recentVaults.map((v) => v.path)).toContain(VAULT.path)
  })

  it('resolution is a pure question: it never writes', async () => {
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    const before = store.get()
    const set = vi.fn()
    await resolveCampusRuntime(
      caps({ store: { get: store.get, set }, vaultExists: async () => false }),
    )
    expect(set).not.toHaveBeenCalled()
    expect(store.get()).toBe(before)
  })
})

describe('device config stays device-scoped', () => {
  it('remembers a vault most-recent-first without duplicating it', () => {
    const a = { path: '/a', name: 'a' }
    const b = { path: '/b', name: 'b' }
    let config: DeviceConfig = { recentVaults: [], lastRuntime: null }
    config = rememberVault(config, a)
    config = rememberVault(config, b)
    config = rememberVault(config, a)
    expect(config.recentVaults.map((v) => v.path)).toEqual(['/a', '/b'])
  })

  it('forgetting a vault removes the entry and nothing else', () => {
    let config: DeviceConfig = { recentVaults: [], lastRuntime: null }
    config = rememberVault(config, { path: '/a', name: 'a' })
    config = rememberVault(config, { path: '/b', name: 'b' })
    config = forgetVault(config, '/b')
    expect(config.recentVaults.map((v) => v.path)).toEqual(['/a'])
    // The other vault's entry survives, and so does the vault itself.
    expect(config.lastRuntime).toBeNull()
  })

  it('survives corrupt preferences rather than blocking startup', () => {
    const store: DeviceStore = { get: () => 'not json{', set: () => {} }
    expect(readDeviceConfig(store)).toEqual({ recentVaults: [], lastRuntime: null })
  })

  it('stores no vault-scoped data — only paths and the last choice', () => {
    const store = memoryStore()
    writeDeviceConfig(store, rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    const raw = JSON.parse(store.get()!) as Record<string, unknown>
    // Recent vaults are a property of this machine, never of the academic
    // workspace. Nothing academic may leak into device preferences.
    expect(Object.keys(raw).sort()).toEqual(['lastRuntime', 'recentVaults'])
  })
})

describe('descriptorFor', () => {
  it('names a vault after its folder', () => {
    expect(descriptorFor('/home/estudiante/Campus').name).toBe('Campus')
    expect(descriptorFor('/home/estudiante/Campus/').name).toBe('Campus')
    expect(descriptorFor('C:\\Users\\est\\Campus').name).toBe('Campus')
  })
})

/**
 * Startup is the one screen with no way out.
 *
 * Every other failure in Campus lands on a screen that offers a retry. If
 * resolution REJECTS, the provider's `.then` never runs, the state stays
 * `resolving`, and the student watches a loading indicator forever. So the
 * contract is absolute: resolution answers with a state, always.
 */
describe('resolution always answers — a loading screen is not a destination', () => {
  const withVault = (over: Partial<RuntimeCapabilities>) =>
    caps({
      store: memoryStore({
        recentVaults: [VAULT],
        lastRuntime: { mode: 'local', path: VAULT.path },
      }),
      ...over,
    })

  it('reports vault-unavailable when the existence check itself fails', async () => {
    const state = await resolveCampusRuntime(
      withVault({
        vaultExists: async () => {
          throw new Error('la API del Vault no respondió')
        },
      }),
    )

    // NOT vault-missing: we did not learn that the folder is gone, we learned
    // nothing. Telling a student their folder moved when it did not sends them
    // hunting through their disk for a problem that is not there.
    expect(state.status).toBe('vault-unavailable')
  })

  it('reports vault-unavailable, with the reason, when the vault is there but will not open', async () => {
    const state = await resolveCampusRuntime(
      withVault({
        vaultExists: async () => true,
        openLocal: async () => {
          throw new Error('permiso denegado')
        },
      }),
    )

    expect(state).toMatchObject({ status: 'vault-unavailable', vault: VAULT })
    expect(state.status === 'vault-unavailable' && state.reason).toContain('permiso denegado')
  })

  it('still reports vault-missing when the check succeeds and says no', async () => {
    // The existing distinction must survive: a definite "it is gone" is a
    // different problem from "I could not ask".
    const state = await resolveCampusRuntime(withVault({ vaultExists: async () => false }))

    expect(state.status).toBe('vault-missing')
  })

  it('falls back to the picker when the cloud check throws', async () => {
    const state = await resolveCampusRuntime(
      caps({
        store: memoryStore({ recentVaults: [], lastRuntime: { mode: 'cloud' } }),
        cloudSession: async () => {
          throw new Error('red caída')
        },
      }),
    )

    expect(state.status).toBe('needs-choice')
  })

  it('falls back to the picker when opening the cloud throws', async () => {
    const state = await resolveCampusRuntime(
      caps({
        store: memoryStore({ recentVaults: [], lastRuntime: { mode: 'cloud' } }),
        cloudSession: async () => true,
        openCloud: async () => {
          throw new Error('sin credenciales')
        },
      }),
    )

    expect(state.status).toBe('needs-choice')
  })

  it('never rejects, whatever every capability does', async () => {
    const explode = () => {
      throw new Error('boom')
    }

    await expect(
      resolveCampusRuntime(
        withVault({
          vaultExists: explode as never,
          openLocal: explode as never,
          cloudSession: explode as never,
          openCloud: explode as never,
        }),
      ),
    ).resolves.toBeDefined()
  })
})
