import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import { normalize, noteResults, search } from './search'
import { statusLabel } from './status-groups'
import type { CurriculumSubject, SubjectStatus, SubjectView } from './types'

describe('noteResults', () => {
  const hits = [
    { path: 'Análisis/Límites.md', title: 'Límites', snippet: 'el límite de una función' },
    { path: 'Daily/2026-08-14.md', title: '2026-08-14', snippet: '' },
  ]

  it('maps note hits to search results of kind note, keyed by path', () => {
    const results = noteResults(hits)
    expect(results[0]).toMatchObject({
      kind: 'note',
      id: 'Análisis/Límites.md',
      title: 'Límites',
      subtitle: 'el límite de una función',
    })
  })

  it('shows the folder when there is no snippet, never the file extension', () => {
    expect(noteResults(hits)[1]?.subtitle).toBe('Daily')
    expect(noteResults([{ path: 'a.md', title: 'a', snippet: '' }])[0]?.subtitle).toBeNull()
    for (const r of noteResults(hits)) expect(r.subtitle ?? '').not.toMatch(/\.md/)
  })

  it('keeps the order it was given and respects the limit', () => {
    expect(noteResults(hits, 1)).toHaveLength(1)
    expect(noteResults(hits).map((r) => r.title)).toEqual(['Límites', '2026-08-14'])
  })
})

describe('subject status wording in results', () => {
  const subject = (id: string, name: string): CurriculumSubject => ({
    id,
    curriculumId: 'c',
    subjectId: `s-${id}`,
    code: null,
    name,
    normalizedName: normalize(name),
    yearLevel: 1,
    term: 'anual',
    credits: null,
    elective: false,
    displayOrder: 0,
  })
  const subjects = computeSubjectViews({
    subjects: [subject('a', 'Física I')],
    prerequisites: [],
    states: [],
  })

  it('says "Disponible para cursar", the wording the rest of the app uses', () => {
    const [result] = search({ subjects, items: [], resources: [] }, 'fisica')
    expect(result?.subtitle).toContain('Disponible para cursar')
  })

  it("does not claim a subject is available when the plan's correlativas are unknown", () => {
    const [result] = search(
      { subjects, items: [], resources: [], prerequisitesKnown: false },
      'fisica',
    )
    expect(result?.subtitle).not.toMatch(/Disponible/)
    expect(result?.subtitle).toContain('Sin marcar')
  })

  it('uses the shared label of every status, never wording of its own', () => {
    const all: SubjectStatus[] = [
      'passed',
      'equivalent',
      'in_progress',
      'regularized',
      'available',
      'blocked',
      'pending',
      'failed',
    ]
    for (const status of all) {
      const view: SubjectView = { ...subjects[0]!, status }
      const [result] = search({ subjects: [view], items: [], resources: [] }, 'fisica')
      expect(result?.subtitle).toBe(`1° año · ${statusLabel(status)}`)
    }
  })
})
