import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `prerequisitesKnown` is a research finding, not a count.
 *
 *   known: true,  edges: []   → this plan genuinely has no correlativas
 *   known: false, edges: []   → we do not know what they are
 *
 * `edgeCount > 0` answers UNKNOWN for both, so it can never produce the first
 * row. That inference used to live in both generators. These tests exist to
 * make bringing it back a failing build rather than a quiet regression, because
 * the mistake is invisible until a plan with genuinely no correlativas arrives —
 * and then Campus makes a false claim about a university.
 */

const ROOT = process.cwd()
const RESEARCH = join(ROOT, 'docs/research/curricula')

const research = (name: string) =>
  JSON.parse(readFileSync(join(RESEARCH, `${name}.json`), 'utf8')) as {
    curriculum: { prerequisites?: { known?: unknown; note?: unknown; source?: unknown } }
    subjects: { prerequisites: unknown[] }[]
  }

const catalog = (name: string) =>
  JSON.parse(
    readFileSync(join(ROOT, 'public/academic-catalog/curricula', `${name}.json`), 'utf8'),
  ) as {
    prerequisitesKnown: boolean
    prerequisitesNote: string | null
    subjects: { prerequisites: unknown[] }[]
  }

describe('the flag is declared at the research layer', () => {
  it('both plans declare it explicitly, with provenance', () => {
    for (const name of ['utn-frro-isi', 'unr-fceia-lcc']) {
      const declared = research(name).curriculum.prerequisites
      expect(declared, `${name} must declare curriculum.prerequisites`).toBeDefined()
      expect(typeof declared!.known, `${name}.known must be a boolean`).toBe('boolean')
      // The source is what makes the flag checkable by a human later.
      expect(String(declared!.source ?? ''), `${name} must cite what it read`).not.toHaveLength(
        0,
      )
    }
  })

  it('an unknown plan explains why, because the student is told', () => {
    const unr = research('unr-fceia-lcc').curriculum.prerequisites!
    expect(unr.known).toBe(false)
    expect(String(unr.note ?? '')).not.toHaveLength(0)
  })
})

describe('the checkpoint — UTN and UNR say different things', () => {
  it('UTN: known, with its 186 correlativas intact', () => {
    const utn = catalog('utn-frro-isi')
    expect(utn.prerequisitesKnown).toBe(true)
    expect(utn.prerequisitesNote).toBeNull()
    expect(utn.subjects.reduce((n, s) => n + s.prerequisites.length, 0)).toBe(186)
  })

  it('UNR: unknown, zero edges, and it says so', () => {
    const unr = catalog('unr-fceia-lcc')
    expect(unr.prerequisitesKnown).toBe(false)
    expect(unr.subjects.reduce((n, s) => n + s.prerequisites.length, 0)).toBe(0)
    expect(unr.prerequisitesNote).not.toBeNull()
  })

  it('the seed agrees with the catalog', () => {
    // Two adapters that disagree about this are two adapters that tell the
    // student different things about their own degree.
    const seed = readFileSync(join(ROOT, 'supabase/seed.sql'), 'utf8')
    const rows = seed
      .split('\n')
      .filter(
        (l) => l.includes('::timestamptz') && (l.includes(', true,') || l.includes(', false,')),
      )
    expect(rows.some((l) => l.includes('TO 2024') && l.includes('false'))).toBe(true)
    expect(rows.some((l) => l.includes('Plan 2023') && l.includes('true, true, NULL'))).toBe(
      true,
    )
  })
})

describe('the generators refuse to infer', () => {
  /** Run a generator against a copy of the research data, with one plan edited. */
  const runWith = (
    mutate: (doc: Record<string, unknown>) => void,
  ): { ok: boolean; stderr: string } => {
    const dir = mkdtempSync(join(tmpdir(), 'campus-research-'))
    try {
      cpSync(join(ROOT, 'docs'), join(dir, 'docs'), { recursive: true })
      cpSync(join(ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true })
      mkdirSync(join(dir, 'public/academic-catalog/curricula'), { recursive: true })

      const target = join(dir, 'docs/research/curricula/utn-frro-isi.json')
      const doc = JSON.parse(readFileSync(target, 'utf8')) as Record<string, unknown>
      mutate(doc)
      writeFileSync(target, JSON.stringify(doc, null, 2))

      try {
        execFileSync('node', ['scripts/generate-catalog.mjs'], { cwd: dir, stdio: 'pipe' })
        return { ok: true, stderr: '' }
      } catch (error) {
        return { ok: false, stderr: String((error as { stderr?: Buffer }).stderr ?? error) }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it('fails loudly when the flag is missing instead of guessing from edges', () => {
    // UTN has 186 edges, so an edge-count inference would happily answer `true`
    // here and nobody would notice the declaration had been dropped.
    const r = runWith((doc) => {
      delete (doc.curriculum as Record<string, unknown>).prerequisites
    })
    expect(r.ok, 'the generator inferred a missing flag instead of failing').toBe(false)
    expect(r.stderr).toMatch(/must be declared/i)
  })

  it('fails when known is false but nobody wrote down why', () => {
    const r = runWith((doc) => {
      ;(doc.curriculum as Record<string, unknown>).prerequisites = { known: false, source: 'x' }
    })
    expect(r.ok).toBe(false)
    expect(r.stderr).toMatch(/note is required/i)
  })

  it('honours known: true even when the plan has zero edges', () => {
    // The case the old inference could not express, and the reason this whole
    // change exists: a plan that genuinely has no correlativas.
    const dir = mkdtempSync(join(tmpdir(), 'campus-research-'))
    try {
      cpSync(join(ROOT, 'docs'), join(dir, 'docs'), { recursive: true })
      cpSync(join(ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true })
      mkdirSync(join(dir, 'public/academic-catalog/curricula'), { recursive: true })

      const target = join(dir, 'docs/research/curricula/utn-frro-isi.json')
      const doc = JSON.parse(readFileSync(target, 'utf8')) as {
        curriculum: Record<string, unknown>
        subjects: { prerequisites: unknown[] }[]
      }
      for (const s of doc.subjects) s.prerequisites = []
      doc.curriculum.prerequisites = {
        known: true,
        note: null,
        source: 'the plan states it has none',
      }
      writeFileSync(target, JSON.stringify(doc, null, 2))

      execFileSync('node', ['scripts/generate-catalog.mjs'], { cwd: dir, stdio: 'pipe' })

      const out = JSON.parse(
        readFileSync(
          join(dir, 'public/academic-catalog/curricula/utn-frro-isi.json'),
          'utf8',
        ),
      ) as { prerequisitesKnown: boolean; subjects: { prerequisites: unknown[] }[] }

      expect(out.subjects.reduce((n, s) => n + s.prerequisites.length, 0)).toBe(0)
      expect(
        out.prerequisitesKnown,
        'zero edges was read as "unknown" — the edge-count inference is back',
      ).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
