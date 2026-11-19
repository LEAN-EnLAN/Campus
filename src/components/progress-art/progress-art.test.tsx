import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StateBlocks, SubjectBubbles, TrophyFill } from '.'
import { layoutBubbles } from './subject-bubbles'
import { countByTone, toneSentence } from './tones'

describe('TrophyFill', () => {
  it('reads the percentage and the counts', () => {
    render(<TrophyFill value={10} total={40} />)
    expect(
      screen.getByRole('img', { name: '25% de la carrera: 10 de 40 materias aprobadas' }),
    ).toBeInTheDocument()
  })

  it('draws no liquid at zero and never overflows past 100%', () => {
    const { container, rerender } = render(<TrophyFill value={0} total={0} />)
    expect(container.querySelector('.art-trophy-fill')).toBeNull()
    rerender(<TrophyFill value={50} total={40} />)
    expect(screen.getByRole('img', { name: /^100% de la carrera/ })).toBeInTheDocument()
  })
})

describe('SubjectBubbles', () => {
  const subjects = [
    { id: 'a', status: 'passed' as const, yearLevel: 1, credits: null },
    { id: 'b', status: 'equivalent' as const, yearLevel: 1, credits: null },
    { id: 'c', status: 'regularized' as const, yearLevel: 2, credits: null },
    { id: 'd', status: 'in_progress' as const, yearLevel: 2, credits: null },
    { id: 'e', status: 'blocked' as const, yearLevel: 3, credits: null },
  ]

  it('draws one bubble per subject and says the counts by state', () => {
    const { container } = render(<SubjectBubbles subjects={subjects} />)
    expect(container.querySelectorAll('circle')).toHaveLength(5)
    expect(
      screen.getByRole('img', {
        name: '5 materias: 2 aprobadas, 1 regularizada, 1 cursando y 1 por cursar',
      }),
    ).toBeInTheDocument()
  })

  it('lays out deterministically, sized by year when there are no credits', () => {
    const first = layoutBubbles(subjects)
    expect(layoutBubbles([...subjects].reverse())).toEqual(first)
    const radius = (id: string) => first.bubbles.find((b) => b.id === id)!.r
    expect(radius('e')).toBeGreaterThan(radius('a'))
  })
})

describe('StateBlocks', () => {
  it('labels every block, zero included, and draws only the non-empty ones', () => {
    const { container } = render(
      <StateBlocks
        blocks={[
          { id: 'c', label: 'materia cursando', count: 1, tone: 'cursando' },
          { id: 'f', label: 'finales pendientes', count: 0, tone: 'regular' },
        ]}
      />,
    )
    expect(
      screen.getByRole('img', { name: '1 materia cursando, 0 finales pendientes' }),
    ).toBeInTheDocument()
    expect(container.querySelectorAll('.art-block')).toHaveLength(1)
  })
})

describe('tones', () => {
  it('folds failed and blocked into "por cursar"', () => {
    expect(toneSentence(countByTone(['failed', 'blocked', 'available']))).toBe('3 por cursar')
  })
})
