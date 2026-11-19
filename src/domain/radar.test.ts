import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import { buildRadar, RADAR_MAX, type RadarInput } from './radar'
import { edge, state, subject } from './test-fixtures'
import type { AcademicItem, AcademicItemKind, SubjectView } from './types'

// Thursday 19 Nov 2026, 10:00 local.
const NOW = new Date(2026, 10, 19, 10, 0)

let seq = 0
function item(
  title: string,
  daysFromNow: number | null,
  over: Partial<AcademicItem> & { hour?: number } = {},
): AcademicItem {
  const { hour = 23, ...rest } = over
  seq += 1
  const due =
    daysFromNow === null
      ? null
      : new Date(2026, 10, 19 + daysFromNow, hour, hour === 23 ? 59 : 0).toISOString()
  return {
    id: `i-${title}-${seq}`,
    curriculumSubjectId: null,
    kind: 'task' as AcademicItemKind,
    title,
    startsAt: null,
    dueAt: due,
    status: 'open',
    notes: null,
    ...rest,
  }
}

function radar(over: Partial<RadarInput> = {}) {
  return buildRadar({ items: [], subjects: [], prerequisitesKnown: true, now: NOW, ...over })
}

const kinds = (list: { kind: string }[]) => list.map((i) => i.kind)

describe('buildRadar: next-up', () => {
  it('puts the single next dated thing first, counted in days', () => {
    const list = radar({ items: [item('TP 2', 5), item('Lectura', 2)] })
    expect(list[0]).toMatchObject({
      kind: 'next-up',
      title: 'Lectura',
      countdown: { unit: 'days', value: 2 },
    })
  })

  it('counts hours when the next thing is today and has a time', () => {
    const today = item('Parcial', 0, { hour: 18, kind: 'midterm' })
    const [hero] = radar({ items: [today], hasTime: () => true })
    expect(hero?.countdown).toEqual({ unit: 'hours', value: 8 })
  })

  it('says "today" for a date-only thing due today', () => {
    const [hero] = radar({ items: [item('Entrega', 0)], hasTime: () => false })
    expect(hero?.countdown).toEqual({ unit: 'today' })
  })

  it('leads to the subject when the item has one', () => {
    const subjects = computeSubjectViews({
      subjects: [subject('fis', 'Física I')],
      prerequisites: [],
      states: [],
    })
    const [hero] = radar({
      subjects,
      items: [item('TP', 4, { curriculumSubjectId: 'fis' })],
    })
    expect(hero?.target).toEqual({ kind: 'subject', subjectId: 'fis' })
    expect(hero?.reason).toBe('Es para el 23/11 · Física I')
  })

  it('ignores done, cancelled and undated items', () => {
    const list = radar({
      items: [
        item('Hecha', 1, { status: 'done' }),
        item('Cancelada', 1, { status: 'cancelled' }),
        item('Sin fecha', null),
      ],
    })
    expect(kinds(list)).toEqual(['all-clear'])
  })
})

describe('buildRadar: due-now', () => {
  it('names a single overdue item and never repeats the hero', () => {
    const late = item('Informe', -2)
    const list = radar({ items: [late, item('Mañana', 1)] })
    const due = list.find((i) => i.kind === 'due-now')
    expect(due?.title).toBe('Atrasada: Informe')
    expect(due?.reason).toBe('Venció el 17/11')
    expect(due?.target).toEqual({ kind: 'agenda', section: 'overdue' })
    expect(list[0]?.kind).toBe('next-up')
  })

  it('summarises several, with correct plurals, leaving the hero out', () => {
    const list = radar({
      items: [item('A', -1), item('B', -3), item('C', 0), item('D', 0, { hour: 20 })],
    })
    const due = list.find((i) => i.kind === 'due-now')
    // D (20:00) comes before C (end of day): D is the hero, C stays in due-now.
    expect(list[0]?.title).toBe('D')
    expect(due?.reason).toBe('2 atrasadas · 1 de hoy')
    expect(due?.title).toBe('Ponete al día')
  })

  it('is absent when the only thing for today is the hero', () => {
    const list = radar({ items: [item('Solo', 0)] })
    expect(kinds(list)).toEqual(['next-up'])
  })
})

describe('buildRadar: get-ahead', () => {
  it('prefers the heavier kind inside 3–14 days', () => {
    const list = radar({
      items: [
        item('Lo primero', 1),
        item('Tarea', 4),
        item('Parcial de Álgebra', 9, { kind: 'midterm' }),
        item('Muy lejos', 20, { kind: 'final' }),
      ],
    })
    const ahead = list.find((i) => i.kind === 'get-ahead')
    expect(ahead?.title).toBe('Adelantá Parcial de Álgebra')
    expect(ahead?.reason).toBe('Faltan 9 días · y 1 otra en dos semanas')
  })

  it('skips classes and inscripciones, which nobody starts early', () => {
    const list = radar({
      items: [
        item('Primero', 1),
        item('Clase', 5, { kind: 'class' }),
        item('Inscripción', 6, { kind: 'registration' }),
      ],
    })
    expect(kinds(list)).not.toContain('get-ahead')
  })

  it('does not repeat the hero when the hero itself is 3+ days away', () => {
    const list = radar({ items: [item('Único', 5, { kind: 'midterm' })] })
    expect(kinds(list)).toEqual(['next-up', 'all-clear'])
  })
})

describe('buildRadar: heavy-week', () => {
  it('flags a week with three evaluations and words them', () => {
    // Mon 23 – Sun 29 Nov.
    const list = radar({
      items: [
        item('P1', 4, { kind: 'midterm' }),
        item('P2', 5, { kind: 'midterm' }),
        item('TP', 6, { kind: 'assignment' }),
      ],
    })
    const heavy = list.find((i) => i.kind === 'heavy-week')
    expect(heavy?.title).toBe('Semana cargada desde el 23/11')
    expect(heavy?.reason).toBe('2 parciales y 1 entrega en la misma semana')
    expect(heavy?.target).toEqual({ kind: 'calendar' })
  })

  it('does not count tasks or a week with only two', () => {
    const list = radar({
      items: [
        item('P1', 4, { kind: 'midterm' }),
        item('T', 5, { kind: 'task' }),
        item('TP', 6, { kind: 'assignment' }),
      ],
    })
    expect(kinds(list)).not.toContain('heavy-week')
  })

  it('says "Semana cargada" for this week', () => {
    // Thu 19 – Sun 22 Nov.
    const list = radar({
      items: [
        item('P1', 0, { kind: 'midterm' }),
        item('P2', 1, { kind: 'final' }),
        item('P3', 2, { kind: 'midterm' }),
      ],
    })
    expect(list.find((i) => i.kind === 'heavy-week')?.title).toBe('Semana cargada')
  })
})

describe('buildRadar: final-to-book', () => {
  const plan = (states = [state('am1', 'regularized'), state('alg', 'regularized')]) =>
    computeSubjectViews({
      subjects: [
        subject('am1', 'Análisis I'),
        subject('alg', 'Álgebra'),
        subject('am2', 'Análisis II', { yearLevel: 2 }),
        subject('fis2', 'Física II', { yearLevel: 2 }),
      ],
      prerequisites: [edge('am2', 'am1', 'to_pass'), edge('fis2', 'am1', 'to_pass')],
      states,
    })

  it('suggests the regularizada whose final habilita the most', () => {
    const list = radar({ subjects: plan() })
    const final = list.find((i) => i.kind === 'final-to-book')
    expect(final?.title).toBe('Rendí Análisis I')
    expect(final?.reason).toBe('Habilita el final de 2 materias')
    expect(final?.target).toEqual({ kind: 'pending-finals' })
  })

  it('skips one whose final is already booked', () => {
    const booked = item('Final AM1', 10, { kind: 'final', curriculumSubjectId: 'am1' })
    const list = radar({ subjects: plan(), items: [booked] })
    expect(list.find((i) => i.kind === 'final-to-book')?.title).toBe('Rendí Álgebra')
  })

  it('claims no habilitación when correlativas are unknown', () => {
    const list = radar({ subjects: plan(), prerequisitesKnown: false })
    expect(list.find((i) => i.kind === 'final-to-book')?.reason).toBe(
      'La regularizaste y no tiene final agendado',
    )
  })
})

describe('buildRadar: unlock-soon', () => {
  function views(prerequisitesKnown = true): SubjectView[] {
    return computeSubjectViews({
      subjects: [
        subject('am1', 'Análisis I'),
        subject('alg', 'Álgebra'),
        subject('am2', 'Análisis II', { yearLevel: 2 }),
        subject('fis2', 'Física II', { yearLevel: 2 }),
        subject('prob', 'Probabilidad', { yearLevel: 2 }),
      ],
      prerequisites: [
        edge('am2', 'am1'),
        edge('fis2', 'am1'),
        // Needs two: not "one away".
        edge('prob', 'am1'),
        edge('prob', 'alg'),
      ],
      states: [state('am1', 'in_progress')],
      prerequisitesKnown,
    })
  }

  it('names the one regularización that opens the most subjects', () => {
    const unlock = radar({ subjects: views() }).find((i) => i.kind === 'unlock-soon')
    expect(unlock?.title).toBe('Análisis I te abre 2 materias')
    expect(unlock?.reason).toBe('Regularizala y podés cursar Análisis II y Física II')
    expect(unlock?.target).toEqual({ kind: 'subject', subjectId: 'am1' })
  })

  it('says nothing when the plan has no published correlativas', () => {
    const list = radar({ subjects: views(false), prerequisitesKnown: false })
    expect(kinds(list)).not.toContain('unlock-soon')
  })

  it('uses the singular for one subject', () => {
    const subjects = computeSubjectViews({
      subjects: [subject('a', 'Química'), subject('b', 'Química II')],
      prerequisites: [edge('b', 'a')],
      states: [],
    })
    const unlock = radar({ subjects }).find((i) => i.kind === 'unlock-soon')
    expect(unlock?.title).toBe('Cerca de cursar Química II')
    expect(unlock?.reason).toBe('Solo te falta regularizar Química')
  })
})

describe('buildRadar: shape', () => {
  it('says all clear with nothing due and mentions what is next', () => {
    const list = radar({ items: [item('Lejos', 3)] })
    expect(list.at(-1)).toMatchObject({
      kind: 'all-clear',
      reason: 'Nada atrasado ni para hoy. Lo próximo es en 3 días.',
      target: { kind: 'capture' },
    })
  })

  it('caps the cards and keeps a deterministic order', () => {
    const subjects = computeSubjectViews({
      subjects: [subject('a', 'A'), subject('b', 'B'), subject('c', 'C', { yearLevel: 2 })],
      prerequisites: [edge('c', 'a'), edge('b', 'c', 'to_pass')],
      states: [state('b', 'regularized')],
    })
    const items = [
      item('Atrasada', -1),
      item('Hoy', 0),
      item('Hoy 2', 0, { hour: 20 }),
      item('P1', 4, { kind: 'midterm' }),
      item('P2', 5, { kind: 'midterm' }),
      item('P3', 6, { kind: 'final' }),
    ]
    const first = radar({ items, subjects })
    const second = radar({ items: [...items].reverse(), subjects })
    expect(first.length).toBe(RADAR_MAX)
    expect(first.map((i) => i.id)).toEqual(second.map((i) => i.id))
    expect(kinds(first)).toEqual([
      'next-up',
      'due-now',
      'heavy-week',
      'get-ahead',
      'final-to-book',
    ])
    expect(new Set(first.map((i) => i.id)).size).toBe(first.length)
  })
})
