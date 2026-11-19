import { describe, expect, it } from 'vitest'

import { indexDestination } from './index-destination'

describe('indexDestination', () => {
  it('sends the desktop app and local builds to Hoy, signed in or not', () => {
    expect(
      indexDestination({ vaultAvailable: true, signedIn: false, authLoading: false }),
    ).toBe('today')
    expect(indexDestination({ vaultAvailable: true, signedIn: false, authLoading: true })).toBe(
      'today',
    )
  })

  it('sends a signed-in student of the hosted build to Hoy', () => {
    expect(
      indexDestination({ vaultAvailable: false, signedIn: true, authLoading: false }),
    ).toBe('today')
  })

  it('shows the landing to a visitor of the hosted build', () => {
    expect(
      indexDestination({ vaultAvailable: false, signedIn: false, authLoading: false }),
    ).toBe('landing')
  })

  it('waits for the session check instead of flashing the landing', () => {
    expect(
      indexDestination({ vaultAvailable: false, signedIn: false, authLoading: true }),
    ).toBe('wait')
  })
})
