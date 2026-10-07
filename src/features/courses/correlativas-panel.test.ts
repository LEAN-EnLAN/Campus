import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from '@/domain/availability'
import { manualToCurriculumSubject } from '@/domain/manual-subjects'
import { subject } from '@/domain/test-fixtures'

import { correlativasNote } from './correlativas-panel'

const viewOf = (s: ReturnType<typeof subject>) =>
  computeSubjectViews({
    subjects: [s],
    prerequisites: [],
    states: [],
    prerequisitesKnown: true,
  })[0]!

describe('correlativasNote', () => {
  it('never claims anything for a subject the student typed in', () => {
    const manual = viewOf(
      manualToCurriculumSubject(
        { id: 'm', name: 'Cálculo', yearLevel: 1, term: '1c', status: null, grade: null },
        0,
      ),
    )
    const note = correlativasNote(manual, true)
    expect(note).toMatch(/a mano/)
    expect(note).not.toMatch(/No te falta ninguna/)
  })

  it('keeps the honest "unknown" wording for a plan without published correlativas', () => {
    expect(correlativasNote(viewOf(subject('a')), false)).toMatch(/no lo vamos a inventar/)
  })

  it('says none are missing only when the plan is known', () => {
    expect(correlativasNote(viewOf(subject('a')), true)).toBe(
      'No te falta ninguna correlativa para cursar esta materia.',
    )
  })
})
