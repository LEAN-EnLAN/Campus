import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AcademicItem } from '@/domain/types'
import { dateOnlyDueAt } from '@/features/items/due'

import { buildAgendaDays } from './agenda-days'
import { AgendaList } from './agenda-list'

const NOW = new Date(2026, 9, 7, 10, 0, 0)

const item = (over: Partial<AcademicItem>): AcademicItem => ({
  id: 'i1',
  curriculumSubjectId: null,
  kind: 'assignment',
  title: 'TP',
  startsAt: null,
  dueAt: null,
  status: 'open',
  notes: null,
  ...over,
})

const typed = (day: number, h: number, m = 0, month = 10) =>
  new Date(2026, month - 1, day, h, m, 0).toISOString()

describe('buildAgendaDays', () => {
  it('starts at today: yesterday is not upcoming', () => {
    const days = buildAgendaDays(
      [
        item({ id: 'past', dueAt: typed(6, 12) }),
        item({ id: 'today', dueAt: typed(7, 9) }),
        item({ id: 'later', dueAt: typed(20, 9) }),
      ],
      NOW,
    )

    expect(days.flatMap((d) => d.items.map((i) => i.id))).toEqual(['today', 'later'])
  })

  it('looks past the current month: an agenda is not a month view', () => {
    const days = buildAgendaDays([item({ id: 'far', dueAt: typed(15, 9, 0, 12) })], NOW)

    expect(days).toHaveLength(1)
  })

  it('puts a due-only item on ONE day, however late it is', () => {
    const days = buildAgendaDays(
      [
        item({ id: 'a', dueAt: dateOnlyDueAt(2026, 10, 23) }),
        item({ id: 'b', dueAt: typed(23, 23, 59) }),
      ],
      NOW,
    )

    expect(days).toHaveLength(1)
    expect(days[0]!.items.map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('leaves out cancelled and undated items', () => {
    const days = buildAgendaDays(
      [item({ id: 'x', status: 'cancelled', dueAt: typed(8, 9) }), item({ id: 'y' })],
      NOW,
    )

    expect(days).toEqual([])
  })

  it('lists a date-only item after the timed ones that day', () => {
    const days = buildAgendaDays(
      [
        item({ id: 'allday', dueAt: dateOnlyDueAt(2026, 10, 8) }),
        item({ id: 'timed', dueAt: typed(8, 15) }),
      ],
      NOW,
    )

    expect(days[0]!.items.map((i) => i.id)).toEqual(['timed', 'allday'])
  })
})

describe('AgendaList', () => {
  it('says so, in Spanish, when there is nothing from today on', () => {
    render(<AgendaList items={[]} now={NOW} subjectName={() => null} />)

    expect(screen.getByText('No tenés nada agendado de hoy en adelante.')).toBeInTheDocument()
  })

  it('writes the header for the period it shows', () => {
    render(<AgendaList items={[]} now={NOW} subjectName={() => null} />)

    expect(screen.getByRole('heading', { name: 'Desde hoy, 7 de octubre' })).toBeInTheDocument()
  })

  it('shows a time only when one was typed, and never "Starts" or "Ends"', () => {
    render(
      <AgendaList
        items={[
          item({ id: 'a', title: 'Con hora', dueAt: typed(8, 16, 30) }),
          item({ id: 'b', title: 'Sin hora', dueAt: dateOnlyDueAt(2026, 10, 9) }),
        ]}
        now={NOW}
        subjectName={() => null}
      />,
    )

    const withTime = screen.getByText('Con hora').closest('li')!
    expect(within(withTime).getByText('16:30')).toBeInTheDocument()
    const without = screen.getByText('Sin hora').closest('li')!
    expect(within(without).getByText('Todo el día')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Starts|Ends|23:59/)
  })

  it('names the subject of each item', () => {
    render(
      <AgendaList
        items={[
          item({ id: 'a', title: 'TP 2', dueAt: typed(8, 16, 30), curriculumSubjectId: 's1' }),
        ]}
        now={NOW}
        subjectName={(i) => (i.curriculumSubjectId === 's1' ? 'Paradigmas' : null)}
      />,
    )

    expect(screen.getByText(/Paradigmas/)).toBeInTheDocument()
  })
})

describe('AgendaList when there is nothing', () => {
  it('says so once, as a quiet sentence', () => {
    const { container } = render(<AgendaList items={[]} now={NOW} subjectName={() => null} />)

    expect(screen.getByText('No tenés nada agendado de hoy en adelante.')).toBeInTheDocument()
    expect(container.querySelector('.border-dashed')).toBeNull()
  })
})
