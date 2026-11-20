import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LANDING_PLANS } from './catalog-plans'
import { LandingPage } from './landing-page'

describe('LandingPage', () => {
  it('has one h1, in two tones, and the landmarks a visitor navigates by', () => {
    const { container } = render(<LandingPage />)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveAccessibleName('Tu plan de estudios, convertido en qué hacer hoy.')
    expect(h1s[0]?.querySelector('.lp-display-blue')).not.toBeNull()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(
      container.querySelectorAll('.lp-watermark[aria-hidden="true"]').length,
    ).toBeGreaterThan(0)
  })

  it('uses only Campus illustrations, each described, never a photo or render', () => {
    const { container } = render(<LandingPage />)
    const images = Array.from(container.querySelectorAll('img'))
    expect(images.length).toBeGreaterThan(0)
    for (const img of images) {
      expect(img.getAttribute('src')).toMatch(/^\/campus-blue-assets\/[a-z-]+\.webp$/)
      expect(img.getAttribute('srcset')).toContain('@2x.webp 2x')
      expect(img.getAttribute('alt')?.length).toBeGreaterThan(8)
      expect(img).toHaveAttribute('width')
      expect(img).toHaveAttribute('height')
      expect(img).toHaveAttribute('loading', 'lazy')
    }
  })

  it('shows the four statuses as the deck does', () => {
    render(<LandingPage />)
    const pills = screen.getByRole('list', { name: 'Los estados de cada materia' })
    expect(
      within(pills)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Aprobada', 'Cursando', 'Regularizada', 'Disponible para cursar'])
  })

  it('lists every bundled plan with the catalog’s own subject count', () => {
    render(<LandingPage />)
    const plans = screen.getByRole('list', { name: 'Planes que ya están en Campus' })
    const items = within(plans).getAllByRole('listitem')
    expect(items).toHaveLength(LANDING_PLANS.length)
    for (const plan of LANDING_PLANS) {
      const item = items.find((li) => li.textContent?.includes(plan.program))
      expect(item, plan.program).toBeDefined()
      expect(item?.textContent).toContain(`${plan.subjectCount}materias · ${plan.version}`)
      if (!plan.prerequisitesKnown) {
        expect(item?.textContent).toContain('todavía no publicó las correlativas')
      }
    }
  })

  it('labels the product preview as an example', () => {
    render(<LandingPage />)
    expect(screen.getByRole('img', { name: /^Ejemplo de la pantalla Hoy/ })).toBeInTheDocument()
  })
})
