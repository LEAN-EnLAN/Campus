import { EventLayoutCalculator } from '@dayflow/react'
import { describe, expect, it } from 'vitest'

import type { AcademicItem } from '@/domain/types'

import { projectAcademicItems } from './academic-events'

/**
 * QA: "dos cosas a la misma hora se pisan". The week and day grids place timed
 * events with DayFlow's EventLayoutCalculator; this pins that OUR projection,
 * fed to THAT calculator, puts two same-hour items side by side — two columns
 * that do not overlap — instead of one on top of the other.
 */

const item = (over: Partial<AcademicItem>): AcademicItem => ({
  id: 'i',
  curriculumSubjectId: null,
  kind: 'midterm',
  title: 'Parcial',
  startsAt: null,
  dueAt: null,
  status: 'open',
  notes: null,
  ...over,
})

const at = (h: number, m = 0) => new Date(2026, 10, 12, h, m).toISOString()

function layoutsFor(items: AcademicItem[], viewType: 'week' | 'day') {
  const { events } = projectAcademicItems(items)
  return EventLayoutCalculator.calculateDayEventLayouts(events, { viewType })
}

describe.each(['week', 'day'] as const)('same-time events in the %s grid', (viewType) => {
  it('splits the column: both visible, neither covering the other', () => {
    const layouts = layoutsFor(
      [
        item({ id: 'parcial', title: 'Parcial de Física', dueAt: at(10) }),
        item({ id: 'tp', kind: 'assignment', title: 'Entrega TP', dueAt: at(10) }),
      ],
      viewType,
    )

    const a = layouts.get('parcial')!
    const b = layouts.get('tp')!
    expect(a).toBeDefined()
    expect(b).toBeDefined()

    // Each takes part of the width, not all of it…
    expect(a.width).toBeLessThan(100)
    expect(b.width).toBeLessThan(100)
    // …at different horizontal positions…
    expect(a.left).not.toBe(b.left)
    // …and the left one ends where (or before) the right one starts.
    const [first, second] = a.left < b.left ? [a, b] : [b, a]
    expect(first.left + first.width).toBeLessThanOrEqual(second.left + 0.01)
  })

  it('leaves a lone event the full width', () => {
    const layouts = layoutsFor([item({ id: 'solo', dueAt: at(10) })], viewType)
    const solo = layouts.get('solo')!
    expect(solo.left).toBe(0)
    expect(solo.width).toBeGreaterThanOrEqual(90)
  })
})
