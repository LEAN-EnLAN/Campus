import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Illustration } from './illustration'
import { ILLUSTRATIONS } from './illustrations'

describe('Illustration', () => {
  it('serves WebP at 1x and 2x with intrinsic size and lazy loading', () => {
    render(<Illustration name="today-empty" />)
    const img = screen.getByRole('img', { name: ILLUSTRATIONS['today-empty'].alt })
    expect(img).toHaveAttribute('src', '/campus-blue-assets/today-empty.webp')
    expect(img).toHaveAttribute(
      'srcset',
      '/campus-blue-assets/today-empty.webp 1x, /campus-blue-assets/today-empty@2x.webp 2x',
    )
    expect(img).toHaveAttribute('width', '640')
    expect(img).toHaveAttribute('height', '400')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('is invisible to assistive tech when decorative', () => {
    const { container } = render(<Illustration name="today-empty" decorative />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('lets the surface override the description and load eagerly', () => {
    render(<Illustration name="workspace-local" alt="Tu carpeta" eager />)
    const img = screen.getByRole('img', { name: 'Tu carpeta' })
    expect(img).toHaveAttribute('loading', 'eager')
  })

  it('ships backgrounds as a single size', () => {
    const { container } = render(<Illustration name="ambient-night" decorative />)
    expect(container.querySelector('img')).not.toHaveAttribute('srcset')
  })

  it('registers one entry per illustration, each with Spanish alt text', () => {
    const entries = Object.entries(ILLUSTRATIONS)
    expect(entries).toHaveLength(43)
    for (const [, v] of entries) expect(v.alt.length).toBeGreaterThan(8)
  })
})
