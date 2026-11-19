import { describe, expect, it } from 'vitest'

import {
  leaveRuntime,
  readDeviceConfig,
  rememberVault,
  setLocalCopy,
  writeDeviceConfig,
  type DeviceStore,
} from './device-config'

function memoryStore(initial: string | null = null): DeviceStore {
  let value = initial
  return { get: () => value, set: (v) => (value = v) }
}

describe('the local-copy answer is remembered per device', () => {
  it('starts unasked', () => {
    expect(readDeviceConfig(memoryStore()).localCopy ?? null).toBeNull()
  })

  it('keeps the answer across reads and survives other device changes', () => {
    const store = memoryStore()
    writeDeviceConfig(
      store,
      setLocalCopy(readDeviceConfig(store), { enabled: true, path: 'C:\\Users\\a\\Copia' }),
    )
    writeDeviceConfig(
      store,
      rememberVault(readDeviceConfig(store), { path: '/x/Campus', name: 'Campus' }),
    )
    writeDeviceConfig(store, leaveRuntime(readDeviceConfig(store)))

    expect(readDeviceConfig(store).localCopy).toEqual({
      enabled: true,
      path: 'C:\\Users\\a\\Copia',
    })
  })

  it('treats a malformed answer as never asked', () => {
    const store = memoryStore(
      JSON.stringify({ recentVaults: [], localCopy: { enabled: 'yes' } }),
    )
    expect(readDeviceConfig(store).localCopy).toBeNull()
  })
})
