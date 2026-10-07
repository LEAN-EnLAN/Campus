import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from './availability'
import {
  distinctMissing,
  finalBlockers,
  finalBlockedSentence,
  isFinalBlocked,
  missingSummary,
  joinNames,
  requirementGroups,
} from './requirements'
import { edge, state, subject } from './test-fixtures'

const SUBJECTS = [
  subject('am1', 'Análisis Matemático I'),
  subject('alg', 'Álgebra y Geometría Analítica'),
  subject('am2', 'Análisis Matemático II'),
]

/** UTN reads the same correlativa twice: regularizada to cursar, aprobada to rendir. */
const EDGES = [
  edge('am2', 'am1', 'to_take'),
  edge('am2', 'alg', 'to_take'),
  edge('am2', 'am1', 'to_pass'),
  edge('am2', 'alg', 'to_pass'),
]

const viewOf = (states: Parameters<typeof state>[1][] = [], ids: string[] = []) => {
  const all = computeSubjectViews({
    subjects: SUBJECTS,
    prerequisites: EDGES,
    states: ids.map((id, i) => state(id, states[i]!)),
  })
  return all.find((v) => v.id === 'am2')!
}

describe('joinNames', () => {
  it('reads like Spanish', () => {
    expect(joinNames([])).toBe('')
    expect(joinNames(['A'])).toBe('A')
    expect(joinNames(['A', 'B'])).toBe('A y B')
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B y C')
  })
})

describe('cursar vs rendir el final', () => {
  it('with both prerequisites only Regularizada: cursable, final not', () => {
    const v = viewOf(['regularized', 'regularized'], ['am1', 'alg'])
    expect(v.status).toBe('available')
    expect(isFinalBlocked(v)).toBe(true)
    expect(finalBlockers(v).map((r) => r.name)).toEqual([
      'Análisis Matemático I',
      'Álgebra y Geometría Analítica',
    ])
    expect(finalBlockedSentence(v)).toBe(
      'Todavía no podés rendir el final: te falta aprobar Análisis Matemático I y Álgebra y Geometría Analítica.',
    )
  })

  it('groups never repeat a subject and mark each item met or unmet', () => {
    const v = viewOf(['regularized', 'passed'], ['am1', 'alg'])
    const groups = requirementGroups(v)
    expect(groups.cursar.map((r) => [r.curriculumSubjectId, r.met])).toEqual([
      ['am1', true],
      ['alg', true],
    ])
    expect(groups.rendir.map((r) => [r.curriculumSubjectId, r.met])).toEqual([
      ['am1', false],
      ['alg', true],
    ])
    expect(finalBlockedSentence(v)).toBe(
      'Todavía no podés rendir el final: te falta aprobar Análisis Matemático I.',
    )
  })

  it('has no second line when the final is open, or when nothing is known', () => {
    const open = viewOf(['passed', 'equivalent'], ['am1', 'alg'])
    expect(isFinalBlocked(open)).toBe(false)
    expect(finalBlockedSentence(open)).toBeNull()
  })

  it('does not call a blocked subject "final bloqueado": it cannot even be taken yet', () => {
    const v = viewOf()
    expect(v.status).toBe('blocked')
    expect(isFinalBlocked(v)).toBe(false)
  })

  it('does not tag a subject already approved', () => {
    const all = computeSubjectViews({
      subjects: SUBJECTS,
      prerequisites: EDGES,
      states: [state('am2', 'passed')],
    })
    expect(isFinalBlocked(all.find((v) => v.id === 'am2')!)).toBe(false)
  })
})

describe('distinctMissing', () => {
  it('counts subjects, not requirement lines', () => {
    // 4 edges, 2 subjects. "faltan 2", never "+3".
    const v = viewOf()
    expect(v.missingRequirements).toHaveLength(4)
    expect(distinctMissing(v).map((r) => r.curriculumSubjectId)).toEqual(['am1', 'alg'])
  })
})

describe('missingSummary — the plan-row phrase', () => {
  it('names the one missing subject', () => {
    const v = viewOf(['passed'], ['alg'])
    expect(missingSummary(v)).toBe('falta Análisis Matemático I')
  })

  it('counts distinct subjects when several are missing, never requirement lines', () => {
    expect(missingSummary(viewOf())).toBe('faltan 2')
  })

  it('says nothing when nothing is missing', () => {
    expect(missingSummary(viewOf(['passed', 'passed'], ['am1', 'alg']))).toBeNull()
  })
})
