import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import { groupResults, matchRange, normalize, noteResults, search } from './search'
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
    // Must use a query that actually reaches the slice: a one-character query
    // short-circuits on the length guard and would pass even with no limit at all.
    const unlimited = search(INPUT, 'a' + 'n')
    expect(unlimited.length).toBeGreaterThan(1)
    expect(search(INPUT, 'an', 1)).toHaveLength(1)
    expect(search(INPUT, 'an', 1)[0]).toEqual(unlimited[0])
  })
})

describe('search beyond titles (QA: "solo indexa nombres de entregas")', () => {
  // Built in LOCAL time so the weekday/day under test does not drift with the TZ.
  const friday = new Date(2026, 10, 13, 18, 0).toISOString() // viernes 13/11/2026
  const items: AcademicItem[] = [
    {
      id: 'i-tp',
      curriculumSubjectId: 'c',
      kind: 'assignment',
      title: 'Informe de laboratorio',
      startsAt: null,
      dueAt: friday,
      status: 'open',
      notes: 'Llevar el péndulo armado y las mediciones de la clase anterior.',
    },
  ]
  const resources: Resource[] = [
    {
      id: 'r-yt',
      curriculumSubjectId: 'c',
      kind: 'link',
      title: 'Clase grabada',
      url: 'https://www.youtube.com/watch?v=abc',
      storagePath: null,
      body: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    },
    {
      id: 'r-txt',
      curriculumSubjectId: null,
      kind: 'note',
      title: 'Resumen',
      url: null,
      storagePath: null,
      body: 'Teorema de Bolzano y valor intermedio',
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ]
  const input = { subjects: SUBJECTS, items, resources }

  it.each(['viernes', '13/11', '13/11/2026', 'noviembre', 'entrega', 'TP', 'fisica'])(
    'finds an item by "%s" (date, kind or materia — not in its title)',
    (q) => {
      const hit = search(input, q).find((r) => r.kind === 'item')
      expect(hit?.id).toBe('i-tp')
    },
  )

  it('finds an item by its notes, accent-insensitive, and shows the matching text', () => {
    const hit = search(input, 'pendulo').find((r) => r.kind === 'item')
    expect(hit?.subtitle).toMatch(/péndulo/)
  })

  it('carries the local day and the materia for deep links', () => {
    const hit = search(input, 'informe')[0]
    expect(hit).toMatchObject({ kind: 'item', date: '2026-11-13', subjectId: 'c' })
    expect(hit?.subtitle).toBe('Entrega · Física I · viernes 13 de noviembre')
  })

  it('a title match outranks a match only in the date or notes', () => {
    const both: AcademicItem[] = [
      { ...items[0]!, id: 'by-date', title: 'Algo' },
      { ...items[0]!, id: 'by-title', title: 'Viernes de consulta', notes: null },
    ]
    expect(search({ subjects: SUBJECTS, items: both, resources: [] }, 'viernes')[0]?.id).toBe(
      'by-title',
    )
  })

  it('finds a resource by its URL host and by its body', () => {
    expect(search(input, 'youtube')[0]?.id).toBe('r-yt')
    expect(search(input, 'youtube')[0]?.subtitle).toBe('Física I · youtube.com')
    const byBody = search(input, 'bolzano')[0]
    expect(byBody?.id).toBe('r-txt')
    expect(byBody?.subtitle).toMatch(/Bolzano/)
  })

  it('does not match the URL path or scheme as if it were the host', () => {
    expect(search(input, 'watch')).toEqual([])
    expect(search(input, 'https')).toEqual([])
  })
})

describe('matchRange', () => {
  it('maps an unaccented query back onto the accented original', () => {
    const text = 'Análisis Matemático I'
    const range = matchRange(text, 'matematico')
    expect(range && text.slice(range.start, range.end)).toBe('Matemático')
  })

  it('handles collapsed whitespace and case', () => {
    const text = 'Física   I  laboratorio'
    const range = matchRange(text, 'I LAB')
    expect(range && text.slice(range.start, range.end)).toBe('I  lab')
  })

  it('returns null when the query is absent', () => {
    expect(matchRange('Física I', 'quimica')).toBeNull()
  })
})

describe('groupResults', () => {
  it('groups by type in a fixed order and drops empty groups', () => {
    const results = [
      ...search(INPUT, 'an'),
      ...noteResults([{ path: 'a.md', title: 'Análisis', snippet: '' }]),
    ]
    const groups = groupResults(results)
    expect(groups.map((g) => g.kind)).toEqual(['subject', 'item', 'resource', 'note'].filter(
      (k) => results.some((r) => r.kind === k),
    ))
    expect(groups.reduce((n, g) => n + g.results.length, 0)).toBe(results.length)
  })
})
