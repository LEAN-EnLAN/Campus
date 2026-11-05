import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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

  it('serves the provisional SVG for a slot still flagged vector', () => {
    render(<Illustration name="ambient-morning" />)
    const img = screen.getByRole('img', { name: ILLUSTRATIONS['ambient-morning'].alt })
    expect(img).toHaveAttribute('src', '/campus-blue-assets/ambient-morning.svg')
    expect(img).not.toHaveAttribute('srcset')
  })

  it('serves only the 1x file at icon size, where it already covers any density', () => {
    render(<Illustration name="settings-career" size="icon" />)
    const img = screen.getByRole('img', { name: ILLUSTRATIONS['settings-career'].alt })
    expect(img).toHaveAttribute('src', '/campus-blue-assets/settings-career.webp')
    expect(img).not.toHaveAttribute('srcset')
  })

  it('has every file the registry points at in public/', () => {
    const dir = join(process.cwd(), 'public', 'campus-blue-assets')
    for (const [name, entry] of Object.entries(ILLUSTRATIONS)) {
      const files = 'vector' in entry ? [`${name}.svg`] : [`${name}.webp`, `${name}@2x.webp`]
      for (const file of files) expect(existsSync(join(dir, file)), file).toBe(true)
    }
  })

  it('ships no file in public/ that the registry does not point at', () => {
    // A provisional SVG left behind after its raster landed is dead weight nobody can reach.
    const dir = join(process.cwd(), 'public', 'campus-blue-assets')
    const expected = new Set(
      Object.entries(ILLUSTRATIONS).flatMap(([name, entry]) =>
        'vector' in entry ? [`${name}.svg`] : [`${name}.webp`, `${name}@2x.webp`],
      ),
    )
    expect(readdirSync(dir).filter((file) => !expected.has(file))).toEqual([])
  })

  it('registers one entry per illustration, each with Spanish alt text', () => {
    const entries = Object.entries(ILLUSTRATIONS)
    expect(entries).toHaveLength(58)
    for (const [, v] of entries) expect(v.alt.length).toBeGreaterThan(8)
  })

  it('is the only way a screen reaches the asset folder', () => {
    // A hand-written path would keep serving the provisional SVG after its raster lands.
    const src = join(process.cwd(), 'src')
    const offenders = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) => join(src, file) !== join(src, 'components', 'ui', 'illustration.tsx'))
      .filter((file) => readFileSync(join(src, file), 'utf8').includes('/campus-blue-assets/'))
    expect(offenders).toEqual([])
  })
})
