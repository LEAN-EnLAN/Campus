import { describe, expect, it } from 'vitest'

import type { AcademicItem } from '@/domain/types'

import { dateOnlyDueAt } from './due'
import { buildToday, daysLeftLabel, todayHeadline } from './today-model'

const NOW = new Date(2026, 9, 7, 10, 0, 0)

const item = (id: string, over: Partial<AcademicItem> = {}): AcademicItem => ({
  id,
  curriculumSubjectId: null,
  kind: 'assignment',
  title: id,
  startsAt: null,
  dueAt: null,
  status: 'open',
  notes: null,
  ...over,
})

const inDays = (n: number, h = 12) => new Date(2026, 9, 7 + n, h, 0, 0).toISOString()

describe('buildToday', () => {
  it('collects the next 14 days under "upcoming", soonest first, with days left', () => {
    const today = buildToday(
      [
        item('in10', { dueAt: inDays(10) }),
        item('tomorrow', { dueAt: inDays(1) }),
        item('in14', { dueAt: inDays(14) }),
        item('in15', { dueAt: inDays(15) }),
      ],
      NOW,
    )

    expect(today.upcoming.map((e) => [e.item.id, e.daysLeft])).toEqual([
      ['tomorrow', 1],
      ['in10', 10],
      ['in14', 14],
    ])
  })

  it('keeps overdue apart from upcoming', () => {
    const today = buildToday([item('late', { dueAt: inDays(-2) })], NOW)

    expect(today.overdue.map((e) => e.item.id)).toEqual(['late'])
    expect(today.upcoming).toEqual([])
  })

  it('lists undated items so nothing the student created is invisible', () => {
    const today = buildToday([item('sin-fecha'), item('con', { dueAt: inDays(2) })], NOW)

    expect(today.undated.map((e) => e.item.id)).toEqual(['sin-fecha'])
  })

  it('does not list done items anywhere', () => {
    const today = buildToday([item('x', { status: 'done', dueAt: inDays(1) })], NOW)

    expect(today.upcoming).toEqual([])
  })

  it('counts a date-only item on its own day, not the next', () => {
    const today = buildToday([item('d', { dueAt: dateOnlyDueAt(2026, 10, 8) })], NOW)

    expect(today.upcoming.map((e) => e.daysLeft)).toEqual([1])
  })
})

describe('daysLeftLabel', () => {
  it('says how many days, the way a person would', () => {
    expect(daysLeftLabel(1)).toBe('Mañana')
    expect(daysLeftLabel(2)).toBe('En 2 días')
    expect(daysLeftLabel(14)).toBe('En 14 días')
  })
})

describe('todayHeadline', () => {
  const base = {
    dueToday: 0,
    upcoming: [] as { title: string; daysLeft: number }[],
    undated: 0,
  }

  it('counts what matters today', () => {
    expect(todayHeadline({ ...base, dueToday: 1 }).title).toBe('Tenés una cosa para hoy.')
    expect(todayHeadline({ ...base, dueToday: 3 }).title).toBe('Tenés 3 cosas para hoy.')
  })

  it('never says there is nothing when something is coming', () => {
    const headline = todayHeadline({
      ...base,
      upcoming: [{ title: 'Parcial de Álgebra', daysLeft: 3 }],
    })

    expect(headline.title).not.toMatch(/No tenés nada/)
    expect(headline.title).toBe('Nada para hoy.')
    expect(headline.description).toBe('Lo próximo: Parcial de Álgebra, en 3 días.')
  })

  it('says "mañana" for tomorrow', () => {
    const headline = todayHeadline({ ...base, upcoming: [{ title: 'TP', daysLeft: 1 }] })

    expect(headline.description).toBe('Lo próximo: TP, mañana.')
  })

  it('does not say "nada" when only undated items exist', () => {
    const headline = todayHeadline({ ...base, undated: 2 })

    expect(headline.title).toBe('Nada con fecha para hoy.')
  })

  it('keeps the original sentence when there is really nothing', () => {
    const headline = todayHeadline(base)

    expect(headline.title).toBe('No tenés nada para hoy.')
    expect(headline.description).toBe('Buen momento para adelantar algo, o para no hacer nada.')
  })
})
