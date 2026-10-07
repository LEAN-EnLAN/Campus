import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

interface VercelConfig {
  framework?: string
  installCommand?: string
  buildCommand?: string
  outputDirectory?: string
  rewrites?: { source: string; destination: string }[]
  headers?: { source: string; headers: { key: string; value: string }[] }[]
}

const config = JSON.parse(
  readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'),
) as VercelConfig

describe('vercel.json — static SPA on Vercel', () => {
  it('builds with the repo toolchain', () => {
    expect(config.framework).toBe('vite')
    expect(config.installCommand).toBe('pnpm install --frozen-lockfile')
    expect(config.buildCommand).toBe('pnpm build')
    expect(config.outputDirectory).toBe('dist')
  })

  it('rewrites deep links to index.html, but never a missing hashed asset or catalog file', () => {
    const rewrite = config.rewrites?.[0]
    expect(rewrite?.destination).toBe('/index.html')
    // Vercel serves real files first and applies rewrites only to what is left,
    // so this pattern only decides what a MISSING path turns into.
    const source = new RegExp(`^${rewrite!.source}$`)

    for (const deepLink of ['/', '/today', '/courses/abc-123', '/login', '/dev']) {
      expect(source.test(deepLink), deepLink).toBe(true)
    }
    // A stale tab asking for a deleted chunk must get a 404, not HTML that the
    // browser then fails to parse as JavaScript.
    for (const missing of ['/assets/index-OLD.js', '/academic-catalog/curricula.json']) {
      expect(source.test(missing), missing).toBe(false)
    }
  })

  it('caches hashed assets for a year, immutable', () => {
    const rule = config.headers?.find((h) => h.source === '/assets/(.*)')
    const cache = rule?.headers.find((h) => h.key === 'Cache-Control')
    expect(cache?.value).toBe('public, max-age=31536000, immutable')
  })

  it('does not long-cache the HTML shell', () => {
    // index.html references the hashed assets; caching it for a year would pin
    // every visitor to a release.
    const longCached = config.headers?.filter((h) =>
      h.headers.some((x) => /max-age=31536000/.test(x.value)),
    )
    expect(longCached?.map((h) => h.source)).toEqual(['/assets/(.*)'])
  })

  describe('security headers on every response', () => {
    const all = () => {
      const rule = config.headers?.find((h) => h.source === '/(.*)')
      return new Map(rule?.headers.map((h) => [h.key, h.value]))
    }

    it('stops MIME sniffing and limits the referrer', () => {
      expect(all().get('X-Content-Type-Options')).toBe('nosniff')
      expect(all().get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })

    it('forbids framing (clickjacking), with the legacy header as well', () => {
      expect(all().get('X-Frame-Options')).toBe('DENY')
      expect(all().get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
    })

    it('uses only CSP directives that cannot break the app', () => {
      // A script-src/default-src policy would have to allow the inline theme
      // bootstrap in index.html, Google Fonts and Supabase (https + wss), and
      // could not be verified without a real browser. These four are safe.
      const csp = all().get('Content-Security-Policy') ?? ''
      const directives = csp.split(';').map((d) => d.trim().split(' ')[0])
      expect(directives.sort()).toEqual([
        'base-uri',
        'form-action',
        'frame-ancestors',
        'object-src',
      ])
    })
  })
})
