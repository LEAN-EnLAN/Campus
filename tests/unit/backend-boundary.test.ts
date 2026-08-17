import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * LOCAL-001 — the backend seam, enforced rather than described.
 *
 * `docs/adr/ADR-local-first-backend.md` says no component or hook may import
 * Supabase. A rule that lives only in a document gets violated by the third
 * person in a hurry, so it lives here too.
 */

// Vitest runs from the project root; deriving it from import.meta.url breaks under
// the jsdom environment.
const ROOT = process.cwd()

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

const SUPABASE_IMPORT = /from\s+['"](@supabase\/supabase-js|@\/lib\/supabase)['"]/

/**
 * The only places allowed to know Supabase exists.
 *
 * `auth-context` is the CLOUD session provider — cloud auth is genuinely its job.
 * `dev.tsx` is tester tooling and only reads the resolved URL to print it.
 */
const ALLOWED = [
  'src/lib/supabase.ts',
  'src/lib/backends/supabase-backend.ts',
  'src/features/auth/auth-context.tsx',
  'src/routes/dev.tsx',
  // The composition root. It is the one place allowed to know that BOTH
  // adapters exist, because choosing between them is exactly its job — see
  // `tests/unit/runtime-boundary.test.ts`, which stops that knowledge leaking
  // any further down.
  'src/app/runtime-capabilities.ts',
]

describe('backend boundary', () => {
  const files = walk(join(ROOT, 'src')).map((f) => relative(ROOT, f))

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('only the adapter and the cloud session provider import Supabase', () => {
    const offenders = files.filter((file) => {
      if (ALLOWED.includes(file)) return false
      return SUPABASE_IMPORT.test(readFileSync(join(ROOT, file), 'utf8'))
    })

    expect(offenders).toEqual([])
  })

  it('no component or route imports Supabase, including the allowed list', () => {
    // Stricter than the rule above: presentation must never reach the database,
    // and `dev.tsx` importing the resolved URL is the one tolerated exception.
    const presentation = files.filter(
      (f) =>
        f.startsWith('src/components/') ||
        (f.startsWith('src/routes/') && f !== 'src/routes/dev.tsx'),
    )
    const offenders = presentation.filter((file) =>
      SUPABASE_IMPORT.test(readFileSync(join(ROOT, file), 'utf8')),
    )

    expect(offenders).toEqual([])
  })

  it('the pure domain layer imports no infrastructure at all', () => {
    const domain = files.filter((f) => f.startsWith('src/domain/') && !f.endsWith('.test.ts'))
    expect(domain.length).toBeGreaterThan(3)

    const offenders = domain.filter((file) => {
      const source = readFileSync(join(ROOT, file), 'utf8')
      return (
        SUPABASE_IMPORT.test(source) ||
        /from\s+['"]react['"]/.test(source) ||
        /from\s+['"]@tanstack\//.test(source) ||
        /from\s+['"]@\/lib\//.test(source)
      )
    })

    expect(offenders).toEqual([])
  })

  it('feature hooks reach the backend through the seam, not the client', () => {
    const hooks = files.filter((f) => f.startsWith('src/features/') && f.endsWith('queries.ts'))
    expect(hooks.length).toBeGreaterThan(0)

    for (const file of hooks) {
      const source = readFileSync(join(ROOT, file), 'utf8')
      expect(source, `${file} should call supabase.from() nowhere`).not.toMatch(
        /supabase\s*\.\s*from\(/,
      )
      // Two legal seams, one rule: a feature hook consumes a CAPABILITY.
      // Academic data rides useBackend(); vault files ride useFiles(), which
      // the composition root wires from the same runtime decision. What stays
      // forbidden is a hook talking to Supabase or the filesystem directly.
      expect(source, `${file} should use a capability seam`).toMatch(
        /useBackend\(\)|useFiles\(\)/,
      )
    }
  })
})
