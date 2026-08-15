import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A-08 invariant: LocalBackend goes through the vault, or A-07 is not a boundary.
 *
 *     LocalBackend → VaultRepository → filesystem
 *     LocalBackend ─X→ node:fs
 *     LocalBackend ─X→ node:path
 *     LocalBackend ─X→ Supabase
 *
 * The moment this file resolves a path itself, every guarantee VAULT-001 makes
 * is only true for the callers that remembered to ask.
 *
 * `node-catalog.ts` is the deliberate exception and is named here rather than
 * pattern-matched: it is the Node reader for read-only reference data, kept in
 * its own module precisely so `node:fs` stays out of the graph the browser
 * bundle imports.
 */

const DIR = join(process.cwd(), 'src/lib/backends/local')
const NODE_READER = 'node-catalog.ts'

/** Code only. A rule that trips on the comment describing it is not a rule. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const sources = () =>
  readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

describe('LocalBackend reaches the disk only through the vault', () => {
  it('no source imports node:fs or node:path', () => {
    const offenders = sources()
      .filter((f) => f !== NODE_READER)
      .filter((f) =>
        /from '(node:fs|node:path)/.test(stripComments(readFileSync(join(DIR, f), 'utf8'))),
      )
    expect(offenders, 'these bypass VaultRepository').toEqual([])
  })

  it('no source imports Supabase', () => {
    const offenders = sources().filter((f) =>
      /@supabase\/supabase-js|lib\/supabase/.test(
        stripComments(readFileSync(join(DIR, f), 'utf8')),
      ),
    )
    expect(offenders, 'the local backend must work with Supabase stopped').toEqual([])
  })

  it('local-backend.ts writes through the vault and never composes paths itself', () => {
    // Comments are stripped first. An assertion that reads prose fails on the
    // module's own docstring describing the rule it follows — which says
    // nothing about the code and trains everyone to weaken the test.
    const src = stripComments(readFileSync(join(DIR, 'local-backend.ts'), 'utf8'))
    // `store.update` is the only writer, and `academic-store.ts` is the only
    // module that knows what a vault path looks like.
    expect(src, 'a vault path was composed here instead of in the store').not.toMatch(
      /\.campus\//,
    )
    expect(src, 'this wrote to the vault directly').not.toMatch(/writeFileAtomic|writeNote/)
  })

  it('the single node:fs reader stays isolated to reference data', () => {
    // If this file ever grows a write, the exception stops being about
    // read-only catalog data and starts being a hole.
    const src = stripComments(readFileSync(join(DIR, NODE_READER), 'utf8'))
    expect(src).not.toMatch(/writeFile|mkdir|rename|rm\(/)
  })
})
