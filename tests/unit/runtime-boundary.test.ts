import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * LOCAL-004, made executable.
 *
 * `tests/unit/backend-boundary.test.ts` already forbids Supabase in presentation
 * code. This forbids the OTHER half, which the local runtime made possible:
 * constructing a backend, or branching on which one is active, anywhere except
 * the composition root.
 *
 * The failure this prevents is not a crash. It is finding
 * `if (mode === 'local')` in nine components in three weeks, at which point the
 * seam no longer exists and both adapters have to be maintained by every screen.
 */

const ROOT = process.cwd()

/** The only modules allowed to know a runtime is a choice. */
const COMPOSITION_ROOT = [
  'src/lib/runtime/context.tsx',
  'src/lib/runtime/resolve.ts',
  'src/lib/runtime/types.ts',
  'src/lib/runtime/device-config.ts',
  'src/lib/backends/context.tsx',
  'src/app/main.tsx',
]

const PRESENTATION = ['src/components', 'src/routes', 'src/features']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/** Code only — a rule that trips on the comment describing it is not a rule. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const presentationFiles = () =>
  PRESENTATION.flatMap((dir) => walk(join(ROOT, dir)))
    .map((f) => relative(ROOT, f))
    .filter((f) => !COMPOSITION_ROOT.includes(f))

describe('the runtime decision does not leak out of the composition root', () => {
  it('no presentation file constructs a backend', () => {
    const offenders = presentationFiles().filter((f) =>
      /\b(new LocalBackend|createSupabaseBackend)\b/.test(
        stripComments(readFileSync(join(ROOT, f), 'utf8')),
      ),
    )
    expect(offenders, 'these build a backend instead of calling useBackend()').toEqual([])
  })

  it('no presentation file imports LocalBackend or the vault', () => {
    const offenders = presentationFiles().filter((f) =>
      /from '@\/lib\/(backends\/local|vault)/.test(
        stripComments(readFileSync(join(ROOT, f), 'utf8')),
      ),
    )
    expect(offenders, 'a screen must not know a vault exists').toEqual([])
  })

  it('no presentation file branches on the runtime mode', () => {
    // The exact shape this whole boundary exists to prevent.
    const offenders = presentationFiles().filter((f) => {
      const src = stripComments(readFileSync(join(ROOT, f), 'utf8'))
      return /mode\s*===\s*['"](local|cloud)['"]/.test(src) || /\buseRuntime\b/.test(src)
    })
    expect(offenders, 'these branch on the runtime instead of using one interface').toEqual([])
  })

  it('the composition root files it names all exist', () => {
    // An allowlist that drifts silently starts permitting files that were
    // renamed away, which is how an exception quietly becomes a hole.
    const missing = COMPOSITION_ROOT.filter((f) => {
      try {
        statSync(join(ROOT, f))
        return false
      } catch {
        return true
      }
    })
    expect(missing).toEqual([])
  })
})
