import { describe, expect, it } from 'vitest'

import { isTesterEnabled, isVaultAvailable } from './build-flags'

describe('isVaultAvailable — the one build-time capability', () => {
  it('is available by default: the dev server and `campus serve` mount the Vault API', () => {
    expect(isVaultAvailable({})).toBe(true)
  })

  it('is unavailable only on an explicit VITE_CAMPUS_VAULT=off', () => {
    expect(isVaultAvailable({ VITE_CAMPUS_VAULT: 'off' })).toBe(false)
  })

  it('does not treat other values as off — a typo must not silently disable local', () => {
    expect(isVaultAvailable({ VITE_CAMPUS_VAULT: 'false' })).toBe(true)
    expect(isVaultAvailable({ VITE_CAMPUS_VAULT: '' })).toBe(true)
    expect(isVaultAvailable({ VITE_CAMPUS_VAULT: 'on' })).toBe(true)
  })
})

describe('isTesterEnabled — tester tooling never ships on a hosted build', () => {
  it('is off unless asked for', () => {
    expect(isTesterEnabled({})).toBe(false)
  })

  it('is on with VITE_CAMPUS_TESTER=1 on a local build', () => {
    expect(isTesterEnabled({ VITE_CAMPUS_TESTER: '1' })).toBe(true)
  })

  it('is forced off on a hosted build even if the flag leaks into the environment', () => {
    // The tester accounts share a published password. A stray env var in the
    // hosting dashboard must not be enough to expose their login screen.
    expect(isTesterEnabled({ VITE_CAMPUS_TESTER: '1', VITE_CAMPUS_VAULT: 'off' })).toBe(false)
  })
})
