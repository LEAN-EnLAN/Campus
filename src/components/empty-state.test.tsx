import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('is one sentence and, at most, one action', () => {
    render(
      <EmptyState
        title="Todavía no escribiste ninguna nota."
        action={<button>Escribir</button>}
      />,
    )

    expect(screen.getByText('Todavía no escribiste ninguna nota.')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('draws the dashed card by default', () => {
    const { container } = render(<EmptyState title="Nada." />)
    expect(container.firstElementChild?.className).toContain('border-dashed')
  })

  it('quiet drops the box, for use inside a section that already has a heading', () => {
    const { container } = render(<EmptyState quiet title="Nada más agendado para hoy." />)

    expect(container.firstElementChild?.className).not.toContain('border')
    expect(screen.getByText('Nada más agendado para hoy.')).toBeInTheDocument()
  })
})
