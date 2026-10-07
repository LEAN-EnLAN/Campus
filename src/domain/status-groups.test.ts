import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import {
  STATUS_GROUPS,
  defaultStatusFilter,
  groupByStatus,
  statusGroupOf,
  statusLabel,
  type StatusGroupId,
} from './status-groups'
import { state, subject } from './test-fixtures'
import type { SubjectStatus } from './types'

describe('status groups', () => {
  it('files Regularizada under its own "Final pendiente", not under Cursando', () => {
    expect(statusGroupOf('regularized')).toBe('final_pendiente')
    expect(statusGroupOf('in_progress')).toBe('cursando')
  })

  it('maps every status deliberately', () => {
    const expected: Record<SubjectStatus, string | null> = {
      available: 'disponibles',
      in_progress: 'cursando',
      regularized: 'final_pendiente',
      passed: 'aprobadas',
      equivalent: 'aprobadas',
      blocked: null,
      pending: null,
      failed: null,
    }
    for (const [status, group] of Object.entries(expected)) {
      expect(statusGroupOf(status as SubjectStatus), status).toBe(group)
    }
  })

  it('has one stable order and Spanish labels', () => {
    expect(STATUS_GROUPS.map((g) => g.label)).toEqual([
      'Disponibles',
      'Cursando',
      'Final pendiente',
      'Aprobadas',
    ])
  })

  it('partitions resolved views, reusable by Hoy', () => {
    const views = computeSubjectViews({
      subjects: [subject('a'), subject('b'), subject('c'), subject('d')],
      prerequisites: [],
      states: [state('a', 'regularized'), state('b', 'regularized'), state('c', 'in_progress')],
    })
    const groups = groupByStatus(views)
    expect(groups.final_pendiente.map((v) => v.id)).toEqual(['a', 'b'])
    expect(groups.cursando.map((v) => v.id)).toEqual(['c'])
    expect(groups.disponibles.map((v) => v.id)).toEqual(['d'])
    expect(groups.aprobadas).toEqual([])
  })
})

describe('defaultStatusFilter', () => {
  const counts = (o: Partial<Record<StatusGroupId, number>>) => ({
    disponibles: 0,
    cursando: 0,
    final_pendiente: 0,
    aprobadas: 0,
    ...o,
  })

  it('opens on what the student is doing now', () => {
    expect(defaultStatusFilter(counts({ cursando: 2, disponibles: 9 }), true)).toBe('cursando')
    expect(defaultStatusFilter(counts({ final_pendiente: 1, disponibles: 9 }), true)).toBe(
      'final_pendiente',
    )
  })

  it('falls through to disponibles, then aprobadas', () => {
    expect(defaultStatusFilter(counts({ disponibles: 3, aprobadas: 1 }), true)).toBe(
      'disponibles',
    )
    expect(defaultStatusFilter(counts({ aprobadas: 1 }), true)).toBe('aprobadas')
  })

  it('never opens on an empty list: everything empty means "todas"', () => {
    expect(defaultStatusFilter(counts({}), true)).toBe('todas')
  })

  it('does not offer disponibles when the plan has no known correlativas', () => {
    expect(defaultStatusFilter(counts({ disponibles: 5 }), false)).toBe('todas')
  })
})

describe('statusLabel', () => {
  it('names every status the way the whole app reads it', () => {
    expect(statusLabel('available')).toBe('Disponible para cursar')
    expect(statusLabel('pending')).toBe('Sin marcar')
    expect(statusLabel('blocked')).toBe('Bloqueada')
    expect(statusLabel('regularized')).toBe('Regularizada')
  })
})
