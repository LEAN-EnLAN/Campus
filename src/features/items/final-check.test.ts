import { describe, expect, it } from 'vitest'

import type { AcademicItem, MissingRequirement, SubjectView } from '@/domain/types'

import { dateOnlyDueAt } from './due'
import { finalNoteSentence, finalPrerequisiteNote } from './final-check'

const subject = (
  id: string,
  name: string,
  missing: Partial<MissingRequirement>[] = [],
): SubjectView =>
  ({
    id,
    name,
    status: 'in_progress',
    missingRequirements: missing.map((m) => ({
      curriculumSubjectId: 'x',
      name: 'x',
      kind: 'to_pass',
      needs: 'aprobar',
      ...m,
    })),
  }) as unknown as SubjectView

const final = (subjectId: string, day: number, id = 'f'): AcademicItem => ({
  id,
  curriculumSubjectId: subjectId,
  kind: 'final',
  title: 'Final',
  startsAt: null,
  dueAt: dateOnlyDueAt(2026, 12, day),
  status: 'open',
  notes: null,
})

const am1Missing = [{ curriculumSubjectId: 'am1', name: 'Análisis I' }]

describe('finalPrerequisiteNote', () => {
  const views = [subject('am1', 'Análisis I'), subject('am2', 'Análisis II', am1Missing)]

  it('flags a prerequisite that is neither passed nor scheduled earlier', () => {
    const note = finalPrerequisiteNote(final('am2', 10), views, [])

    expect(note).toEqual({ missing: ['Análisis I'] })
  })

  it('stays quiet when the prerequisite has its own final on an earlier date', () => {
    const items = [final('am1', 3, 'am1-final')]

    expect(finalPrerequisiteNote(final('am2', 10), views, items)).toBeNull()
  })

  it('still flags a prerequisite whose final is the same day or later', () => {
    expect(finalPrerequisiteNote(final('am2', 10), views, [final('am1', 10, 'a')])).toEqual({
      missing: ['Análisis I'],
    })
    expect(finalPrerequisiteNote(final('am2', 10), views, [final('am1', 20, 'a')])).toEqual({
      missing: ['Análisis I'],
    })
  })

  it('ignores a cancelled final of the prerequisite', () => {
    const cancelled = { ...final('am1', 3, 'a'), status: 'cancelled' as const }

    expect(finalPrerequisiteNote(final('am2', 10), views, [cancelled])).toEqual({
      missing: ['Análisis I'],
    })
  })

  it('stays quiet when nothing blocks the final (passed and equivalencias are not "missing")', () => {
    const none = [subject('am2', 'Análisis II', [])]

    expect(finalPrerequisiteNote(final('am2', 10), none, [])).toBeNull()
  })

  it('does not care about prerequisites for cursar', () => {
    const toTake = [subject('am2', 'Análisis II', [{ kind: 'to_take', needs: 'cursar' }])]

    expect(finalPrerequisiteNote(final('am2', 10), toTake, [])).toBeNull()
  })

  it('lists every prerequisite that qualifies, once each', () => {
    const many = [
      subject('x', 'X', [
        { curriculumSubjectId: 'a', name: 'A' },
        { curriculumSubjectId: 'a', name: 'A' },
        { curriculumSubjectId: 'b', name: 'B' },
      ]),
    ]

    expect(finalPrerequisiteNote(final('x', 10), many, [])).toEqual({ missing: ['A', 'B'] })
  })

  it('has nothing to say about anything but a Final with a subject and a date', () => {
    const exam = { ...final('am2', 10), kind: 'midterm' as const }
    const noSubject = { ...final('am2', 10), curriculumSubjectId: null }
    const noDate = { ...final('am2', 10), dueAt: null }

    expect(finalPrerequisiteNote(exam, views, [])).toBeNull()
    expect(finalPrerequisiteNote(noSubject, views, [])).toBeNull()
    expect(finalPrerequisiteNote(noDate, views, [])).toBeNull()
  })

  it('says nothing when the plan declares no prerequisites (we do not invent them)', () => {
    expect(
      finalPrerequisiteNote(final('am2', 10), [subject('am2', 'Análisis II')], []),
    ).toBeNull()
  })
})

describe('finalNoteSentence', () => {
  it('names the subject and tells the student they can ignore it', () => {
    const text = finalNoteSentence({ missing: ['Análisis I'] })

    expect(text).toContain('aprobada Análisis I')
    expect(text).toContain('ignorá este aviso')
  })

  it('agrees in number', () => {
    expect(finalNoteSentence({ missing: ['A', 'B', 'C'] })).toContain('aprobadas A, B y C')
  })
})
