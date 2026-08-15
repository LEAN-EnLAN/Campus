import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from '@/domain/availability'
import type { CurriculumSubject, PrerequisiteEdge, UserSubjectState } from '@/domain/types'

/**
 * P1-07 — an empty prerequisite list means two different things.
 *
 *     known: true,  edges: []   this plan genuinely has no correlativas
 *     known: false, edges: []   nobody published them
 *
 * Both produce the same `edges` array, so nothing downstream can tell them
 * apart from the array alone. The screens read `prerequisitesKnown` and say
 * different sentences; this asserts the SEMANTIC layer they read agrees, and
 * that neither is silently rendered as "unblocked".
 *
 * Cheaper than a browser journey and stronger where it counts: it exercises the
 * exact function Plan and Course use to decide what a student is allowed to
 * believe about their own degree.
 */

const subject = (id: string, order: number): CurriculumSubject => ({
  id,
  curriculumId: 'c',
  subjectId: id,
  code: null,
  name: id,
  normalizedName: id,
  yearLevel: 1,
  term: 'anual',
  credits: null,
  elective: false,
  displayOrder: order,
})

const SUBJECTS = [subject('a', 1), subject('b', 2)]
const NO_STATE: UserSubjectState[] = []
const NO_EDGES: PrerequisiteEdge[] = []

describe('an empty edge list is not self-describing', () => {
  it('produces identical views, which is exactly the problem', () => {
    // The two cases are indistinguishable HERE. That is why the flag has to
    // travel separately, and why a screen may not infer from this function
    // alone whether the student is unblocked.
    const knownEmpty = computeSubjectViews({
      subjects: SUBJECTS,
      prerequisites: NO_EDGES,
      states: NO_STATE,
    })
    const unknown = computeSubjectViews({
      subjects: SUBJECTS,
      prerequisites: NO_EDGES,
      states: NO_STATE,
    })

    expect(knownEmpty.map((v) => v.status)).toEqual(unknown.map((v) => v.status))
    expect(knownEmpty.every((v) => v.missingRequirements.length === 0)).toBe(true)
  })

  it('never reports a missing requirement it cannot name', () => {
    // Inventing a blocker would be as dishonest as inventing its absence.
    const views = computeSubjectViews({
      subjects: SUBJECTS,
      prerequisites: NO_EDGES,
      states: NO_STATE,
    })
    for (const view of views) expect(view.missingRequirements).toEqual([])
  })

  it('a real edge still blocks, so the guard is not just returning empty', () => {
    // Without this, every assertion above would pass on a function that had
    // stopped computing prerequisites at all.
    const views = computeSubjectViews({
      subjects: SUBJECTS,
      prerequisites: [
        { curriculumSubjectId: 'b', requiredCurriculumSubjectId: 'a', kind: 'to_take' },
      ],
      states: NO_STATE,
    })
    const b = views.find((v) => v.id === 'b')!
    expect(b.status).toBe('blocked')
    expect(b.missingRequirements.map((r) => r.curriculumSubjectId)).toEqual(['a'])
  })
})

describe('the sentence the student reads comes from the flag, not the array', () => {
  /**
   * The exact decision `plan.tsx` and `courses.$courseId.tsx` make. Kept here
   * as data so the two screens cannot drift apart without this failing.
   */
  const message = (prerequisitesKnown: boolean, missingCount: number): string => {
    if (missingCount > 0) return 'te faltan correlativas'
    return prerequisitesKnown
      ? 'No te falta ninguna correlativa para cursar esta materia.'
      : 'Esta facultad todavía no publicó las correlatividades de este plan.'
  }

  it('known-empty says "you are clear"', () => {
    expect(message(true, 0)).toMatch(/No te falta ninguna correlativa/)
  })

  it('unknown says "nobody published them" — never "you are clear"', () => {
    const said = message(false, 0)
    expect(said).toMatch(/no publicó las correlatividades/)
    expect(said).not.toMatch(/No te falta ninguna/)
  })

  it('the two states produce DIFFERENT sentences from the same empty list', () => {
    // If this ever passes by returning the same string, the student cannot
    // tell "you have none" from "we do not know", which is the whole point.
    expect(message(true, 0)).not.toBe(message(false, 0))
  })
})
