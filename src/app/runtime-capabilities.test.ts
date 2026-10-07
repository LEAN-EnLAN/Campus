import { describe, expect, it } from 'vitest'

import { resolveRuntimeCapabilities } from './runtime-capabilities'

describe('resolveRuntimeCapabilities — the build-time Vault capability', () => {
  it('offers the Vault on a normal build', () => {
    expect(resolveRuntimeCapabilities({}).vaultAvailable).toBe(true)
  })

  it('withdraws it on a hosted build (VITE_CAMPUS_VAULT=off)', () => {
    expect(resolveRuntimeCapabilities({ VITE_CAMPUS_VAULT: 'off' }).vaultAvailable).toBe(false)
  })
})
