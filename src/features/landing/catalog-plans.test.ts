import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { LANDING_PLANS } from './catalog-plans'

function curriculum(file: string) {
  const path = join(process.cwd(), 'public', 'academic-catalog', 'curricula', file)
  return JSON.parse(readFileSync(path, 'utf8')) as {
    id: string
    version: string
    prerequisitesKnown: boolean
    subjects: unknown[]
  }
}

describe('the plans the landing shows', () => {
  it('are exactly the bundled catalog, with its own counts', () => {
    const files = JSON.parse(
      readFileSync(join(process.cwd(), 'public', 'academic-catalog', 'curricula.json'), 'utf8'),
    ) as string[]
    expect(LANDING_PLANS).toHaveLength(files.length)

    for (const file of files) {
      const plan = curriculum(file)
      const shown = LANDING_PLANS.find((p) => p.id === plan.id)
      expect(shown, plan.id).toBeDefined()
      expect(shown?.subjectCount).toBe(plan.subjects.length)
      expect(shown?.version).toBe(plan.version)
      expect(shown?.prerequisitesKnown).toBe(plan.prerequisitesKnown)
    }
  })

  it('names the institution and program a student would look for', () => {
    expect(LANDING_PLANS.map((p) => `${p.institution} · ${p.program}`).sort()).toEqual([
      'UNR · Licenciatura en Ciencias de la Computación',
      'UTN · Ingeniería en Sistemas de Información',
    ])
  })
})
