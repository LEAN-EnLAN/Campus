import { describe, expect, it } from 'vitest'

import {
  buildAgenda,
  dayOffset,
  itemsInRange,
  startOfWeek,
  todayCount,
  weekDays,
} from './agenda'
import type { AcademicItem } from './types'

/** Local-time ISO string, so tests do not depend on the runner's timezone. */
function localIso(y: number, m: number, d: number, h = 12, min = 0): string {
  return new Date(y, m - 1, d, h, min).toISOString()
}

function item(overrides: Partial<AcademicItem> & { id: string }): AcademicItem {
  return {
    curriculumSubjectId: null,
    kind: 'assignment',
    title: 'Entrega',
    startsAt: null,
    dueAt: null,
    status: 'open',
    notes: null,
    ...overrides,
  }
}

const NOW = new Date(2026, 7, 14, 10, 0) // Friday 14 August 2026, local

describe('dayOffset', () => {
  it('is zero for two instants on the same local day', () => {
    expect(dayOffset(new Date(2026, 7, 14, 1), new Date(2026, 7, 14, 23))).toBe(0)
  })

  it('counts calendar days, not elapsed hours', () => {
    // 23:00 → 01:00 is two hours but one day.
    expect(dayOffset(new Date(2026, 7, 14, 23), new Date(2026, 7, 15, 1))).toBe(1)
  })

  it('is negative for the past', () => {
    expect(dayOffset(NOW, new Date(2026, 7, 12))).toBe(-2)
  })
})

describe('buildAgenda', () => {
  it('separates overdue, today, tomorrow, this week and later', () => {
    const agenda = buildAgenda(
      [
        item({ id: 'past', dueAt: localIso(2026, 8, 12), title: 'TP atrasado' }),
        item({ id: 'now', dueAt: localIso(2026, 8, 14, 18), title: 'TP 4' }),
        item({ id: 'soon', dueAt: localIso(2026, 8, 15), title: 'Parcial' }),
        item({ id: 'week', dueAt: localIso(2026, 8, 19), title: 'Entrega' }),
        item({ id: 'later', dueAt: localIso(2026, 9, 30), title: 'Final' }),
      ],
      NOW,
    )

    expect(agenda.overdue.map((e) => e.item.id)).toEqual(['past'])
    expect(agenda.today.map((e) => e.item.id)).toEqual(['now'])
    expect(agenda.tomorrow.map((e) => e.item.id)).toEqual(['soon'])
    expect(agenda.week.map((e) => e.item.id)).toEqual(['week'])
    expect(agenda.later.map((e) => e.item.id)).toEqual(['later'])
  })

  it('hides done and cancelled items', () => {
    const agenda = buildAgenda(
      [
        item({ id: 'a', dueAt: localIso(2026, 8, 14), status: 'done' }),
        item({ id: 'b', dueAt: localIso(2026, 8, 14), status: 'cancelled' }),
        item({ id: 'c', dueAt: localIso(2026, 8, 14), status: 'open' }),
      ],
      NOW,
    )

    expect(agenda.today.map((e) => e.item.id)).toEqual(['c'])
  })

  it('falls back to startsAt when there is no due date', () => {
    const agenda = buildAgenda(
      [item({ id: 'class', kind: 'class', startsAt: localIso(2026, 8, 14, 9) })],
      NOW,
    )
    expect(agenda.today.map((e) => e.item.id)).toEqual(['class'])
  })

  it('keeps undated items visible instead of dropping them', () => {
    const agenda = buildAgenda([item({ id: 'someday', title: 'Leer apunte' })], NOW)
    expect(agenda.undated.map((e) => e.item.id)).toEqual(['someday'])
  })

  it('keeps an item with an unparseable date visible rather than losing it', () => {
    const agenda = buildAgenda([item({ id: 'broken', dueAt: 'not-a-date' })], NOW)
    expect(agenda.undated.map((e) => e.item.id)).toEqual(['broken'])
  })

  it('sorts within a bucket chronologically', () => {
    const agenda = buildAgenda(
      [
        item({ id: 'late', dueAt: localIso(2026, 8, 14, 20), title: 'Física' }),
        item({ id: 'early', dueAt: localIso(2026, 8, 14, 9), title: 'Arquitectura' }),
      ],
      NOW,
    )
    expect(agenda.today.map((e) => e.item.id)).toEqual(['early', 'late'])
  })

  it('counts overdue plus today as what matters now', () => {
    const agenda = buildAgenda(
      [
        item({ id: 'a', dueAt: localIso(2026, 8, 10) }),
        item({ id: 'b', dueAt: localIso(2026, 8, 14) }),
        item({ id: 'c', dueAt: localIso(2026, 8, 20) }),
      ],
      NOW,
    )
    expect(todayCount(agenda)).toBe(2)
  })

  it('returns empty buckets rather than throwing on no items', () => {
    const agenda = buildAgenda([], NOW)
    expect(todayCount(agenda)).toBe(0)
    expect(agenda.later).toEqual([])
  })
})

describe('itemsInRange', () => {
  it('includes both endpoint days in full', () => {
    const items = [
      item({ id: 'start', dueAt: localIso(2026, 8, 10, 0, 30) }),
      item({ id: 'mid', dueAt: localIso(2026, 8, 12) }),
      item({ id: 'end', dueAt: localIso(2026, 8, 14, 23, 30) }),
      item({ id: 'out', dueAt: localIso(2026, 8, 15) }),
    ]
    const found = itemsInRange(items, new Date(2026, 7, 10), new Date(2026, 7, 14))
    expect(found.map((i) => i.id)).toEqual(['start', 'mid', 'end'])
  })

  it('excludes cancelled items but keeps done ones for the calendar record', () => {
    const items = [
      item({ id: 'done', dueAt: localIso(2026, 8, 12), status: 'done' }),
      item({ id: 'cancelled', dueAt: localIso(2026, 8, 12), status: 'cancelled' }),
    ]
    const found = itemsInRange(items, new Date(2026, 7, 10), new Date(2026, 7, 14))
    expect(found.map((i) => i.id)).toEqual(['done'])
  })
})

describe('startOfWeek / weekDays', () => {
  it('starts the week on Monday', () => {
    // 14 Aug 2026 is a Friday → Monday is the 10th.
    expect(startOfWeek(NOW).getDate()).toBe(10)
  })

  it('treats Sunday as the end of the previous week', () => {
    // 16 Aug 2026 is a Sunday → Monday is still the 10th.
    expect(startOfWeek(new Date(2026, 7, 16)).getDate()).toBe(10)
  })

  it('returns seven consecutive days', () => {
    const days = weekDays(NOW)
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.getDate())).toEqual([10, 11, 12, 13, 14, 15, 16])
  })
})
