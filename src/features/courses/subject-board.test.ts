import { describe, expect, it } from 'vitest'

import type {
  CurriculumSubject,
  StoredSubjectStatus,
  SubjectStatus,
  SubjectView,
} from '@/domain/types'

import {
  buildSubjectBoard,
  columnOf,
  statusForColumn,
  type BoardColumnId,
} from './subject-board'

function subject(over: Partial<SubjectView> & { id: string }): SubjectView {
  const base: CurriculumSubject = {
    id: over.id,
    curriculumId: 'cur-1',
    subjectId: `s-${over.id}`,
    code: null,
    name: over.id.toUpperCase(),
    normalizedName: over.id,
    yearLevel: 1,
    term: 'anual',
    credits: null,
    elective: false,
    displayOrder: 0,
  }

  return {
    ...base,
    status: 'available',
    grade: null,
    notes: null,
    missingRequirements: [],
    unlocks: [],
    ...over,
  }
}

/** Every value `SubjectStatus` can hold, so a new status cannot slip in untested. */
const ALL_STATUSES: SubjectStatus[] = [
  'in_progress',
  'regularized',
  'passed',
  'failed',
  'equivalent',
  'pending',
  'available',
  'blocked',
]

describe('columnOf', () => {
  const CASES: { status: SubjectStatus; column: BoardColumnId | null }[] = [
    { status: 'available', column: 'disponibles' },
    { status: 'in_progress', column: 'cursando' },
    { status: 'regularized', column: 'cursando' },
    { status: 'passed', column: 'aprobadas' },
    { status: 'equivalent', column: 'aprobadas' },
    { status: 'blocked', column: null },
    { status: 'pending', column: null },
    { status: 'failed', column: null },
  ]

  it.each(CASES)('maps $status to $column', ({ status, column }) => {
    expect(columnOf(status)).toBe(column)
  })

  it('covers every SubjectStatus value', () => {
    expect(CASES.map((c) => c.status).sort()).toEqual([...ALL_STATUSES].sort())
  })
})

describe('statusForColumn', () => {
  it('clears the stored status for disponibles instead of storing a derived one', () => {
    const stored = statusForColumn('disponibles')

    // `available` is DERIVED from prerequisites and is not a StoredSubjectStatus.
    // Writing it would let the database drift out of sync with the graph, so the
    // only correct answer is `null` — "forget what I stored".
    expect(stored).toBeNull()
    expect(stored).not.toBe('available')
    expect(typeof stored).not.toBe('string')
  })

  it('maps cursando to in_progress and aprobadas to passed', () => {
    expect(statusForColumn('cursando')).toBe('in_progress')
    expect(statusForColumn('aprobadas')).toBe('passed')
  })

  it('only ever yields a storable status or null', () => {
    const storable: StoredSubjectStatus[] = [
      'in_progress',
      'regularized',
      'passed',
      'failed',
      'equivalent',
    ]
    const columns: BoardColumnId[] = ['disponibles', 'cursando', 'aprobadas']

    for (const column of columns) {
      const stored = statusForColumn(column)
      if (stored !== null) expect(storable).toContain(stored)
    }
  })
})

describe('buildSubjectBoard', () => {
  it('returns the three columns in board order even when empty', () => {
    const board = buildSubjectBoard([])

    expect(board.columns.map((c) => c.id)).toEqual(['disponibles', 'cursando', 'aprobadas'])
    expect(board.columns.map((c) => c.name)).toEqual(['Disponibles', 'Cursando', 'Aprobadas'])
    expect(board.offBoard).toEqual([])
  })

  it('routes each status to its column', () => {
    const board = buildSubjectBoard([
      subject({ id: 'a', status: 'available' }),
      subject({ id: 'b', status: 'in_progress' }),
      subject({ id: 'c', status: 'regularized' }),
      subject({ id: 'd', status: 'passed' }),
      subject({ id: 'e', status: 'equivalent' }),
    ])

    const ids = (column: BoardColumnId) =>
      board.columns.find((c) => c.id === column)!.subjects.map((s) => s.id)

    expect(ids('disponibles')).toEqual(['a'])
    expect(ids('cursando')).toEqual(['b', 'c'])
    expect(ids('aprobadas')).toEqual(['d', 'e'])
  })

  it('names blocked, pending and failed subjects in offBoard and in no column', () => {
    const off = [
      subject({ id: 'blocked-one', status: 'blocked' }),
      subject({ id: 'pending-one', status: 'pending' }),
      subject({ id: 'failed-one', status: 'failed' }),
    ]
    const board = buildSubjectBoard([...off, subject({ id: 'on', status: 'available' })])

    expect(board.offBoard.map((s) => s.id)).toEqual([
      'blocked-one',
      'failed-one',
      'pending-one',
    ])

    // A board that silently swallows subjects is the failure mode this guards:
    // every input must come out either in a column or named in offBoard.
    const inColumns = board.columns.flatMap((c) => c.subjects.map((s) => s.id))
    for (const s of off) expect(inColumns).not.toContain(s.id)
    expect([...inColumns, ...board.offBoard.map((s) => s.id)].sort()).toEqual(
      ['blocked-one', 'failed-one', 'on', 'pending-one'].sort(),
    )
  })

  it('loses no subject, whatever the status', () => {
    const subjects = ALL_STATUSES.map((status, i) =>
      subject({ id: `s${i}`, status, displayOrder: i }),
    )
    const board = buildSubjectBoard(subjects)

    const placed = [...board.columns.flatMap((c) => c.subjects), ...board.offBoard]
    expect(placed).toHaveLength(subjects.length)
    expect(new Set(placed.map((s) => s.id)).size).toBe(subjects.length)
  })

  it('sorts a column by year, then displayOrder, then name', () => {
    const board = buildSubjectBoard([
      subject({ id: 'y2-b', status: 'available', yearLevel: 2, displayOrder: 1 }),
      subject({ id: 'y1-late', status: 'available', yearLevel: 1, displayOrder: 9 }),
      subject({ id: 'y2-a', status: 'available', yearLevel: 2, displayOrder: 0 }),
      subject({ id: 'y1-early', status: 'available', yearLevel: 1, displayOrder: 0 }),
    ])

    expect(board.columns[0]!.subjects.map((s) => s.id)).toEqual([
      'y1-early',
      'y1-late',
      'y2-a',
      'y2-b',
    ])
  })

  it('breaks a displayOrder tie by name using Spanish collation', () => {
    const board = buildSubjectBoard([
      subject({ id: 'z', name: 'Álgebra II', status: 'available' }),
      subject({ id: 'y', name: 'Algebra I', status: 'available' }),
      subject({ id: 'x', name: 'Biología', status: 'available' }),
    ])

    // 'Á' collates with 'A' in Spanish, so the tie is decided by the rest of the
    // name — a codepoint sort would push 'Álgebra II' behind 'Biología'.
    expect(board.columns[0]!.subjects.map((s) => s.name)).toEqual([
      'Algebra I',
      'Álgebra II',
      'Biología',
    ])
  })

  it('sorts offBoard by the same rule', () => {
    const board = buildSubjectBoard([
      subject({ id: 'b', status: 'blocked', yearLevel: 3, displayOrder: 0 }),
      subject({ id: 'a', status: 'pending', yearLevel: 1, displayOrder: 4 }),
      subject({ id: 'c', status: 'failed', yearLevel: 1, displayOrder: 2 }),
    ])

    expect(board.offBoard.map((s) => s.id)).toEqual(['c', 'a', 'b'])
  })

  it('does not mutate or alias the input array', () => {
    const input = [
      subject({ id: 'b', status: 'available', displayOrder: 1 }),
      subject({ id: 'a', status: 'available', displayOrder: 0 }),
    ]
    const snapshot = input.map((s) => s.id)

    const board = buildSubjectBoard(input)

    expect(input.map((s) => s.id)).toEqual(snapshot)
    expect(board.columns[0]!.subjects).not.toBe(input)
  })
})
