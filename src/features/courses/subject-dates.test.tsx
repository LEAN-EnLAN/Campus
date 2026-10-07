import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AcademicItem } from '@/domain/types'
import { dateOnlyDueAt } from '@/features/items/due'

import { SubjectDateRow } from './subject-dates'

const item = (dueAt: string | null): AcademicItem => ({
  id: 'i',
  curriculumSubjectId: null,
  kind: 'assignment',
  title: 'Entrega',
  startsAt: null,
  dueAt,
  status: 'open',
  notes: null,
})

/** Local time, so the test holds in any timezone. */
const at = (h: number, m: number, s = 0, ms = 0) =>
  new Date(2026, 9, 23, h, m, s, ms).toISOString()

const mount = (dueAt: string | null) =>
  render(<SubjectDateRow item={item(dueAt)} onToggle={() => {}} />)

describe('the Fechas row of a course', () => {
  it('shows a real 23:59 deadline with its time', () => {
    mount(at(23, 59))
    expect(screen.getByText(/vie 23\/10/)).toHaveTextContent('23:59')
  })

  it('reads exact midnight as a bare date written by hand, with no time', () => {
    mount(at(0, 0))
    expect(screen.getByText(/vie 23\/10/)).not.toHaveTextContent('00:00')
  })

  it('shows no time for a date-only item', () => {
    mount(dateOnlyDueAt(2026, 10, 23))
    const cell = screen.getByText(/vie 23\/10/)
    expect(cell).not.toHaveTextContent('23:59')
    expect(cell).not.toHaveTextContent('·')
  })

  it('still shows an ordinary time', () => {
    mount(at(18, 30))
    expect(screen.getByText(/vie 23\/10/)).toHaveTextContent('18:30')
  })

  it('says Sin fecha for an undated item', () => {
    mount(null)
    expect(screen.getByText('Sin fecha')).toBeInTheDocument()
  })
})
