import { describe, expect, it } from 'vitest'

import { STATUS_GROUPS } from '@/domain/status-groups'
import type { SubjectStatus } from '@/domain/types'

import { GROUP_STATUS, STATUS } from './academic-status-vocabulary'

describe('status vocabulary', () => {
  it('gives every status its own shape, so colour is never the only difference', () => {
    const statuses = Object.keys(STATUS) as SubjectStatus[]
    const icons = new Set(statuses.map((status) => STATUS[status].Icon))
    expect(icons.size).toBe(statuses.length)
  })

  it('maps every Materias group to a status, so filters wear the rows’ glyphs', () => {
    for (const group of STATUS_GROUPS) {
      expect(STATUS[GROUP_STATUS[group.id]]).toBeDefined()
    }
  })
})
