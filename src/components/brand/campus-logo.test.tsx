import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CampusLogo } from './campus-logo'

const source = readFileSync(join(process.cwd(), 'public', 'brand', 'campus-mark.svg'), 'utf8')

describe('CampusLogo', () => {
  it('draws exactly the approved geometry of public/brand/campus-mark.svg', () => {
    const { container } = render(<CampusLogo />)
    const path = container.querySelector('path')
    const dot = container.querySelector('circle')
    const group = container.querySelector('g')
    expect(source).toContain(`d="${path?.getAttribute('d')}"`)
    expect(source).toContain(`stroke-width="${path?.getAttribute('stroke-width')}"`)
    expect(source).toContain(`transform="${group?.getAttribute('transform')}"`)
    for (const attr of ['cx', 'cy', 'r'])
      expect(source).toContain(`${attr}="${dot?.getAttribute(attr)}"`)
  })

  it('is announced as Campus on its own, and lets the wordmark speak when present', () => {
    const { rerender, container } = render(<CampusLogo />)
    expect(screen.getByRole('img', { name: 'Campus' })).toBeInTheDocument()

    rerender(<CampusLogo wordmark tone="dark" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container).toHaveTextContent('Campus')
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'dark')
  })
})
