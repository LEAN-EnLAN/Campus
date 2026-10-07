import { describe, expect, it } from 'vitest'

import {
  isCurrentSection,
  isInMore,
  MORE_ITEMS,
  NAV,
  showsFloatingAdd,
  TAB_ITEMS,
} from './nav-model'

describe('navigation model', () => {
  it('leaves no desktop destination without a way to reach it on a phone', () => {
    const reachable = new Set([...TAB_ITEMS, ...MORE_ITEMS].map((item) => item.to))
    for (const item of NAV) expect(reachable.has(item.to)).toBe(true)
  })

  it('keeps Vault, Material and Ajustes behind "Más"', () => {
    expect(MORE_ITEMS.map((item) => item.label)).toEqual(['Vault', 'Material', 'Ajustes'])
  })

  it('keeps four direct tabs plus "Más" so each tab stays above 56px at 375px', () => {
    expect(TAB_ITEMS).toHaveLength(4)
  })

  it('treats the bare root as Hoy', () => {
    expect(isCurrentSection('/', '/today')).toBe(true)
    expect(isCurrentSection('/plan', '/today')).toBe(false)
  })

  it('knows when the student is somewhere behind "Más"', () => {
    expect(isInMore('/vault')).toBe(true)
    expect(isInMore('/settings')).toBe(true)
    expect(isInMore('/plan')).toBe(false)
  })
})

describe('floating add button', () => {
  it.each(['/today', '/plan', '/courses', '/calendar'])('is shown on %s', (path) => {
    expect(showsFloatingAdd(path)).toBe(true)
  })

  it.each(['/courses/algebra-12', '/library', '/vault', '/settings'])(
    'is hidden on %s, where the page has its own add control or would be covered',
    (path) => {
      expect(showsFloatingAdd(path)).toBe(false)
    },
  )
})
