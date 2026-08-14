import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * ACADEMIC-001 / ACADEMIC-002.
 *
 * The portable LOCAL catalog and the CLOUD seed are generated from the same
 * verified research JSON. This suite exists so they cannot silently drift, and so
 * the distinction that makes the plan screen trustworthy survives the trip into
 * the local format:
 *
 *     unknown prerequisites  ≠  no prerequisites
 */

const ROOT = process.cwd()
const RESEARCH = join(ROOT, 'docs/research/curricula')
const CATALOG = join(ROOT, 'resources/academic-catalog')

interface CatalogSubject {
  id: string
  name: string
  yearLevel: number
  term: string
  verified: boolean
  prerequisites: { subjectId: string; kind: string }[]
}

interface CatalogCurriculum {
  id: string
  version: string
  sourceUrl: string | null
  sourceKind: string | null
  retrievedAt: string | null
  prerequisitesKnown: boolean
  prerequisitesNote: string | null
  subjects: CatalogSubject[]
}

function catalogFiles(): CatalogCurriculum[] {
  return readdirSync(join(CATALOG, 'curricula'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(CATALOG, 'curricula', f), 'utf8')))
}

function researchFiles() {
  return readdirSync(RESEARCH)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f, plan: JSON.parse(readFileSync(join(RESEARCH, f), 'utf8')) }))
}

describe('portable academic catalog', () => {
  const catalog = catalogFiles()
  const research = researchFiles()

  it('has one curriculum per researched plan', () => {
    expect(catalog).toHaveLength(research.length)
    expect(catalog.length).toBeGreaterThan(1) // two institutions prove the model is not UTN-specific
  })

  it('is regenerable — running the generator produces no diff', () => {
    const before = readdirSync(join(CATALOG, 'curricula'))
      .sort()
      .map((f) => readFileSync(join(CATALOG, 'curricula', f), 'utf8'))
      .join('\n')

    execFileSync('node', ['scripts/generate-catalog.mjs'], { cwd: ROOT, stdio: 'ignore' })

    const after = readdirSync(join(CATALOG, 'curricula'))
      .sort()
      .map((f) => readFileSync(join(CATALOG, 'curricula', f), 'utf8'))
      .join('\n')

    // A hand-edit of the catalog would show up here, which is the point: there is
    // one source of truth and this is not it.
    expect(after).toBe(before)
  })

  it('carries the same subject count as the research it came from', () => {
    for (const { plan } of research) {
      const id = `${plan.institution.slug}/${plan.academic_unit.slug}/${plan.program.slug}/${plan.curriculum.version}`
      const entry = catalog.find((c) => c.id === id)
      expect(entry, `catalog is missing ${id}`).toBeDefined()
      expect(entry!.subjects).toHaveLength(plan.subjects.length)
    }
  })

  it('preserves provenance on every curriculum', () => {
    for (const curriculum of catalog) {
      expect(curriculum.sourceUrl, `${curriculum.id} lost its source`).toBeTruthy()
      expect(curriculum.sourceKind).toBeTruthy()
      expect(curriculum.retrievedAt).toBeTruthy()
    }
  })

  it('preserves the per-subject verified flag', () => {
    const unverified = catalog.flatMap((c) => c.subjects.filter((s) => !s.verified))
    // UTN's three elective blocks and the Práctica Profesional Supervisada: the
    // Ordenanza does not document their level or term.
    expect(unverified).toHaveLength(4)
  })

  // --- the invariant this whole file exists for -----------------------------

  it('marks a plan with published correlativas as known', () => {
    const utn = catalog.find((c) => c.id.startsWith('utn/'))
    expect(utn?.prerequisitesKnown).toBe(true)
    const edges = utn!.subjects.reduce((n, s) => n + s.prerequisites.length, 0)
    expect(edges).toBe(186)
  })

  it('marks a plan whose faculty published none as UNKNOWN, not empty', () => {
    const unr = catalog.find((c) => c.id.startsWith('unr/'))
    expect(unr).toBeDefined()
    expect(unr!.subjects.length).toBeGreaterThan(0)

    // The empty array alone would read as "nothing blocks you". The flag is what
    // stops Campus asserting an academic fact it does not have.
    expect(unr!.prerequisitesKnown).toBe(false)
    expect(unr!.prerequisitesNote).toMatch(/no publicó las correlatividades/)
  })

  it('never claims prerequisites are known while carrying zero edges', () => {
    for (const curriculum of catalog) {
      const edges = curriculum.subjects.reduce((n, s) => n + s.prerequisites.length, 0)
      if (curriculum.prerequisitesKnown) {
        expect(edges, `${curriculum.id} claims known with no edges`).toBeGreaterThan(0)
      } else {
        expect(edges, `${curriculum.id} claims unknown but has edges`).toBe(0)
        expect(curriculum.prerequisitesNote).toBeTruthy()
      }
    }
  })

  it('has no dangling prerequisite references', () => {
    for (const curriculum of catalog) {
      const ids = new Set(curriculum.subjects.map((s) => s.id))
      for (const subject of curriculum.subjects) {
        for (const p of subject.prerequisites) {
          expect(
            ids.has(p.subjectId),
            `${curriculum.id}: ${subject.name} → ${p.subjectId}`,
          ).toBe(true)
        }
      }
    }
  })

  it('uses only the Argentine term vocabulary', () => {
    for (const curriculum of catalog) {
      for (const subject of curriculum.subjects) {
        expect(['anual', '1c', '2c']).toContain(subject.term)
      }
    }
  })
})
