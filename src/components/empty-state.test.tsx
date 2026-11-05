import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmptyState, ErrorState } from './empty-state'

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

  it('takes a registry name and serves its raster, silent beside the title', () => {
    const { container } = render(
      <EmptyState illustration="courses-empty" title="Todavía no cargaste materias" />,
    )
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', '/campus-blue-assets/courses-empty.webp')
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('width', '640')
    expect(img).toHaveAttribute('height', '400')
  })
})

describe('ErrorState', () => {
  it('stays a bare alert unless the error is the whole screen', () => {
    const { container, rerender } = render(<ErrorState />)
    expect(container.querySelector('img')).toBeNull()

    rerender(<ErrorState illustration="gentle-error" />)
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/campus-blue-assets/gentle-error.webp',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar esto')
  })
})
