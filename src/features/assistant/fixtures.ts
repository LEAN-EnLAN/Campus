import { computeSubjectViews, type AvailabilityInput } from '@/domain/availability'
import { edge, state, subject } from '@/domain/test-fixtures'
import type { AcademicItem } from '@/domain/types'
import { dateOnlyDueAt } from '@/features/items/due'

import type { AssistantData } from './context'

/** Test data for the assistant. Not imported by runtime code. */

export const NOW = new Date(2026, 10, 19, 10, 0) // jueves 19/11/2026

const SUBJECTS = [
  subject('am1', 'Análisis Matemático I', { yearLevel: 1, term: '1c', displayOrder: 1 }),
  subject('alg', 'Álgebra', { yearLevel: 1, term: '1c', displayOrder: 2 }),
  subject('am2', 'Análisis Matemático II', { yearLevel: 1, term: '2c', displayOrder: 3 }),
  subject('so', 'Sistemas Operativos', { yearLevel: 2, term: 'anual', displayOrder: 4 }),
  subject('redes', 'Redes de Datos', { yearLevel: 3, term: '2c', displayOrder: 5 }),
]

const EDGES = [
  edge('am2', 'am1', 'to_take'),
  edge('am2', 'alg', 'to_take'),
  edge('am2', 'am1', 'to_pass'),
  edge('redes', 'so', 'to_take'),
  edge('redes', 'so', 'to_pass'),
]

function item(id: string, overrides: Partial<AcademicItem>): AcademicItem {
  return {
    id,
    curriculumSubjectId: null,
    kind: 'assignment',
    title: id,
    startsAt: null,
    dueAt: null,
    status: 'open',
    notes: null,
    ...overrides,
  }
}

export const ITEMS: AcademicItem[] = [
  item('tp2', {
    title: 'TP 2',
    curriculumSubjectId: 'so',
    dueAt: dateOnlyDueAt(2026, 11, 20),
    notes: 'nota privada que no sale del dispositivo',
  }),
  item('parcial', { title: 'Parcial 1', kind: 'midterm', dueAt: dateOnlyDueAt(2026, 11, 25) }),
  item('vencida', { title: 'Informe', dueAt: dateOnlyDueAt(2026, 11, 10) }),
  item('lejos', { title: 'Final Álgebra', kind: 'final', dueAt: dateOnlyDueAt(2026, 12, 30) }),
  item('sinfecha', { title: 'Leer apunte', kind: 'task' }),
]

export function assistantData(overrides: Partial<AssistantData> = {}): AssistantData {
  const availabilityInput: AvailabilityInput = {
    subjects: SUBJECTS,
    prerequisites: EDGES,
    states: [state('am1', 'regularized'), state('alg', 'passed'), state('so', 'in_progress')],
  }
  return {
    now: NOW,
    programName: 'Ingeniería de Prueba',
    isUnmapped: false,
    prerequisitesKnown: true,
    prerequisitesNote: null,
    views: computeSubjectViews(availabilityInput),
    items: ITEMS,
    availabilityInput,
    ...overrides,
  }
}
