import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BrandWatermark } from './brand-watermark'
import { CampusLogo } from './campus-logo'

describe('BrandWatermark', () => {
  it('is the mark itself, hidden from assistive tech', () => {
    const { container } = render(<BrandWatermark className="extra" />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveClass('brand-watermark', 'extra')

    const logo = render(<CampusLogo />).container
    expect(container.querySelector('path')?.getAttribute('d')).toBe(
      logo.querySelector('path')?.getAttribute('d'),
    )
    for (const attr of ['cx', 'cy', 'r'])
      expect(container.querySelector('circle')?.getAttribute(attr)).toBe(
        logo.querySelector('circle')?.getAttribute(attr),
      )
  })
})
