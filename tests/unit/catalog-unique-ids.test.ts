import { execFileSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * USR-10 — UNR lists "Horas electivas" twice and the catalog gave both the id
 * `horas-electivas-33`, because ids were looked up BY NAME and the last
 * display_order won. Marking one marked the other, and the progress
 * denominator counted one slot twice. Ids are now per slot, and a generator
 * that would emit a duplicate refuses instead.
 */

const ROOT = process.cwd()

interface Plan {
  subjects: {
    name: string
    year_level: number
    term: string
    display_order: number
    elective?: boolean
    credits?: number | null
    code?: string | null
    verified?: boolean
    prerequisites: { subject_name: string; kind: string }[]
  }[]
}

describe('the committed catalog', () => {
  const dir = join(ROOT, 'public/academic-catalog/curricula')

  it('has unique subject ids inside every curriculum', () => {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const ids = (
        JSON.parse(readFileSync(join(dir, file), 'utf8')) as { subjects: { id: string }[] }
      ).subjects.map((s) => s.id)
      expect(new Set(ids).size, `${file} has duplicate ids`).toBe(ids.length)
    }
  })

  it('gives UNR\'s two "Horas electivas" slots different ids', () => {
    const unr = JSON.parse(readFileSync(join(dir, 'unr-fceia-lcc.json'), 'utf8')) as {
      subjects: { id: string; name: string }[]
    }
    const ids = unr.subjects.filter((s) => s.name === 'Horas electivas').map((s) => s.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('the generators', () => {
  /** Run one generator against a copy of the research data with the UNR plan edited. */
  const run = (script: string, mutate: (plan: Plan) => void) => {
    const dir = mkdtempSync(join(tmpdir(), 'campus-ids-'))
    try {
      cpSync(join(ROOT, 'docs'), join(dir, 'docs'), { recursive: true })
      cpSync(join(ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true })
      mkdirSync(join(dir, 'public/academic-catalog/curricula'), { recursive: true })
      mkdirSync(join(dir, 'supabase'), { recursive: true })

      const target = join(dir, 'docs/research/curricula/unr-fceia-lcc.json')
      const plan = JSON.parse(readFileSync(target, 'utf8')) as Plan
      mutate(plan)
      writeFileSync(target, JSON.stringify(plan, null, 2))

      try {
        execFileSync('node', [`scripts/${script}`], { cwd: dir, stdio: 'pipe' })
        return { ok: true, stderr: '' }
      } catch (error) {
        return { ok: false, stderr: String((error as { stderr?: Buffer }).stderr ?? error) }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  const twin = (plan: Plan, order: number) => {
    const slot = plan.subjects.find((s) => s.name === 'Horas electivas')!
    plan.subjects.push({ ...slot, display_order: order })
  }

  for (const script of ['generate-catalog.mjs', 'generate-seed.mjs']) {
    it(`${script} FAILS when two slots would share an id`, () => {
      // Same name AND same display_order: indistinguishable, so one id for both.
      const r = run(script, (plan) => {
        const slot = plan.subjects.find((s) => s.name === 'Horas electivas')!
        twin(plan, slot.display_order)
      })
      expect(r.ok, 'a duplicate id was written instead of refused').toBe(false)
      expect(r.stderr).toMatch(/duplicate/i)
    })

    it(`${script} accepts repeated names that differ by plan position`, () => {
      expect(run(script, (plan) => twin(plan, 99)).ok).toBe(true)
    })
  }

  it('generate-catalog refuses a prerequisite that names an ambiguous subject', () => {
    const r = run('generate-catalog.mjs', (plan) => {
      plan.subjects
        .find((s) => s.name === 'Tesina')!
        .prerequisites.push({
          subject_name: 'Horas electivas',
          kind: 'to_take',
        })
    })
    expect(r.ok).toBe(false)
    expect(r.stderr).toMatch(/ambiguous/i)
  })
})
