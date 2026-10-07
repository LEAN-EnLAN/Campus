import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import { STATUS_GROUPS, groupByStatus, statusGroupOf } from './status-groups'
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
