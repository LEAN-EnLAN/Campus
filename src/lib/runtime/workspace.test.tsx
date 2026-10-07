import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { CampusBackend } from '@/lib/backends/types'

import { RuntimeProvider } from './context'
import {
  readDeviceConfig,
  rememberVault,
  type DeviceConfig,
  type DeviceStore,
} from './device-config'
import type { RuntimeCapabilities } from './resolve'
import type { CampusRuntime } from './types'
import { useWorkspace } from './workspace'

/**
 * The workspace seam: screens learn WHAT is open (a folder, or an account) and
 * can ask to leave it. They never learn which runtime mode produced the answer.
 */

const VAULT = { path: '/home/estudiante/Campus', name: 'Campus' }

function memoryStore(initial?: DeviceConfig): DeviceStore {
  let value = initial ? JSON.stringify(initial) : null
  return { get: () => value, set: (v) => (value = v) }
}

function caps(
  over: Partial<RuntimeCapabilities> & { store: DeviceStore },
): RuntimeCapabilities {
  return {
    vaultAvailable: true,
    vaultExists: async () => true,
    openLocal: async (vault) =>
      ({
        mode: 'local',
        vault,
        backend: {} as CampusBackend,
        access: {},
      }) as unknown as CampusRuntime,
    cloudSession: async () => true,
    openCloud: async () => ({ mode: 'cloud', backend: {} as CampusBackend }) as CampusRuntime,
    ...over,
  }
}

/** A screen: asks the workspace, never the runtime. */
function Screen() {
  const workspace = useWorkspace()
  return (
    <div>
      <p>
        {workspace.folder
          ? `carpeta: ${workspace.folder.name} en ${workspace.folder.path}`
          : 'cuenta'}
      </p>
      <button onClick={workspace.change}>Cambiar</button>
    </div>
  )
}

const mount = (capabilities: RuntimeCapabilities, onWorkspaceClosed?: () => void) =>
  render(
    <RuntimeProvider
      capabilities={capabilities}
      onWorkspaceClosed={onWorkspaceClosed}
      fallback={() => <p>selector</p>}
    >
      <Screen />
    </RuntimeProvider>,
  )

describe('useWorkspace', () => {
  it('names the open folder and where it lives', async () => {
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    mount(caps({ store }))

    expect(
      await screen.findByText('carpeta: Campus en /home/estudiante/Campus'),
    ).toBeInTheDocument()
  })

  it('reports no folder when the workspace is an account', async () => {
    const store = memoryStore({ recentVaults: [], lastRuntime: { mode: 'cloud' } })
    mount(caps({ store }))

    expect(await screen.findByText('cuenta')).toBeInTheDocument()
  })

  it('returns to the picker when the student changes workspace', async () => {
    const user = userEvent.setup()
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    mount(caps({ store }))

    await user.click(await screen.findByRole('button', { name: 'Cambiar' }))

    expect(await screen.findByText('selector')).toBeInTheDocument()
  })

  it('keeps the folder in recents but stops reopening it automatically', async () => {
    const user = userEvent.setup()
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    mount(caps({ store }))

    await user.click(await screen.findByRole('button', { name: 'Cambiar' }))
    await screen.findByText('selector')

    const config = readDeviceConfig(store)
    expect(config.lastRuntime).toBeNull()
    expect(config.recentVaults).toEqual([VAULT])
  })

  it('tells the composition root to drop what the closed workspace cached', async () => {
    const user = userEvent.setup()
    const closed = vi.fn()
    const store = memoryStore(rememberVault({ recentVaults: [], lastRuntime: null }, VAULT))
    mount(caps({ store }), closed)

    await user.click(await screen.findByRole('button', { name: 'Cambiar' }))

    await waitFor(() => expect(closed).toHaveBeenCalledOnce())
  })
})
