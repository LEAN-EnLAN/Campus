import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import { normalize, search } from './search'
import type { AcademicItem, CurriculumSubject, Resource } from './types'

function subject(id: string, name: string, code: string | null = null): CurriculumSubject {
  return {
    id,
    curriculumId: 'cur-1',
    subjectId: `s-${id}`,
    code,
    name,
    normalizedName: normalize(name),
    yearLevel: 1,
    term: 'anual',
    credits: null,
    elective: false,
    displayOrder: 0,
  }
}

const SUBJECTS = computeSubjectViews({
  subjects: [
    subject('a', 'Análisis Matemático I', 'AM1'),
    subject('b', 'Álgebra y Geometría Analítica'),
    subject('c', 'Física I'),
  ],
  prerequisites: [],
  states: [],
})

const ITEMS: AcademicItem[] = [
  {
    id: 'i1',
    curriculumSubjectId: 'a',
    kind: 'midterm',
    title: 'Parcial de Análisis',
    startsAt: null,
    dueAt: null,
    status: 'open',
    notes: null,
  },
]

const RESOURCES: Resource[] = [
  {
    id: 'r1',
    curriculumSubjectId: 'a',
    kind: 'link',
    title: 'Apunte de límites',
    url: 'https://example.org/apunte',
    storagePath: null,
    body: null,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
]

const INPUT = { subjects: SUBJECTS, items: ITEMS, resources: RESOURCES }

describe('normalize', () => {
  it('strips accents and lowercases', () => {
    expect(normalize('Análisis Matemático I')).toBe('analisis matematico i')
  })

  it('collapses whitespace', () => {
    expect(normalize('  Física   I  ')).toBe('fisica i')
  })
})

describe('search', () => {
  it('matches without accents — the way a student actually types', () => {
    const results = search(INPUT, 'matematico')
    expect(results.some((r) => r.title === 'Análisis Matemático I')).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(search(INPUT, 'FISICA')).toHaveLength(1)
  })

  it('matches a subject code', () => {
    const results = search(INPUT, 'am1')
    expect(results[0]?.title).toBe('Análisis Matemático I')
  })

  it('finds items and resources, not just subjects', () => {
    expect(search(INPUT, 'parcial')[0]?.kind).toBe('item')
    expect(search(INPUT, 'apunte')[0]?.kind).toBe('resource')
  })

  it('ranks a prefix match above a mid-word match', () => {
    const results = search(INPUT, 'analisis')
    expect(results[0]?.kind).toBe('subject')
    expect(results[0]?.title).toBe('Análisis Matemático I')
  })

  it('returns nothing for a query shorter than two characters', () => {
    expect(search(INPUT, 'a')).toEqual([])
    expect(search(INPUT, '')).toEqual([])
  })

  it('returns an empty array when nothing matches', () => {
    expect(search(INPUT, 'quimica organica')).toEqual([])
  })

  it('respects the result limit', () => {
    expect(search(INPUT, 'a', 1)).toEqual([])
    expect(search(INPUT, 'i', 1)).toEqual([])
  })
})
