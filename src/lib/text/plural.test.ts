import { describe, expect, it } from 'vitest'

import { countLabel, plural } from './plural'

describe('plural', () => {
  it('uses the singular only for exactly one', () => {
    expect(plural(1, 'materia', 'materias')).toBe('materia')
    expect(plural(2, 'materia', 'materias')).toBe('materias')
  })

  it('takes the plural for zero, as Spanish does', () => {
    expect(plural(0, 'final pendiente', 'finales pendientes')).toBe('finales pendientes')
  })

  it('never builds a plural on its own', () => {
    expect(plural(3, 'parcial', 'parciales')).toBe('parciales')
  })
})

describe('countLabel', () => {
  it('puts the count before its word', () => {
    expect(countLabel(1, 'materia cursando', 'materias cursando')).toBe('1 materia cursando')
    expect(countLabel(4, 'disponible', 'disponibles')).toBe('4 disponibles')
  })
})
