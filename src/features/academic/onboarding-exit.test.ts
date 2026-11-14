import { describe, expect, it } from 'vitest'

import { onboardingExit, parseOnboardingSearch } from './onboarding-exit'

describe('onboardingExit', () => {
  // QA: a brand-new student finished onboarding and was offered "Volver a ajustes".
  it('sends a new student who just saved their plan to Hoy, not "back" to Ajustes', () => {
    expect(onboardingExit({ from: undefined, hasContext: true })).toEqual({
      to: '/today',
      label: 'Ir a Hoy',
    })
  })

  it('offers "Volver a ajustes" only to a student who came from Ajustes', () => {
    expect(onboardingExit({ from: 'settings', hasContext: true })).toEqual({
      to: '/settings',
      label: 'Volver a ajustes',
    })
  })

  it('offers no way out before a plan is saved', () => {
    expect(onboardingExit({ from: undefined, hasContext: false })).toBeNull()
    expect(onboardingExit({ from: 'settings', hasContext: false })).toBeNull()
  })
})

describe('parseOnboardingSearch', () => {
  it('keeps only from=settings', () => {
    expect(parseOnboardingSearch({ from: 'settings' })).toEqual({ from: 'settings' })
    expect(parseOnboardingSearch({ from: 'elsewhere' })).toEqual({})
    expect(parseOnboardingSearch({})).toEqual({})
  })
})
