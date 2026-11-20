import { describe, expect, it } from 'vitest'

import {
  parseSettingsSearch,
  resolveSettingsSection,
  sectionFromLegacyHash,
  settingsNav,
} from './settings-sections'

describe('parseSettingsSearch', () => {
  it('keeps a known section and drops anything else', () => {
    expect(parseSettingsSearch({ seccion: 'apariencia' })).toEqual({ seccion: 'apariencia' })
    expect(parseSettingsSearch({ seccion: 'Apariencia' })).toEqual({})
    expect(parseSettingsSearch({ seccion: 3 })).toEqual({})
    expect(parseSettingsSearch({ otra: 'cosa' })).toEqual({})
  })
})

describe('sectionFromLegacyHash', () => {
  it('maps the old one-page anchors to their sections', () => {
    expect(sectionFromLegacyHash('asistente')).toBe('asistente')
    expect(sectionFromLegacyHash('#settings-export')).toBe('datos')
    expect(sectionFromLegacyHash('settings-delete-account')).toBe('cuenta')
    expect(sectionFromLegacyHash('')).toBeNull()
    expect(sectionFromLegacyHash('nada')).toBeNull()
  })
})

describe('settingsNav / resolveSettingsSection', () => {
  it('offers Cuenta only with an account, and never opens it without one', () => {
    const local = settingsNav({ hasAccount: false })
    const cloud = settingsNav({ hasAccount: true })
    const ids = (nav: typeof local) => nav.flatMap((g) => g.items.map((i) => i.id))

    expect(ids(local)).not.toContain('cuenta')
    expect(ids(cloud)).toContain('cuenta')
    expect(resolveSettingsSection('cuenta', local)).toBe('carrera')
    expect(resolveSettingsSection('cuenta', cloud)).toBe('cuenta')
    expect(resolveSettingsSection(undefined, cloud)).toBe('carrera')
  })
})
