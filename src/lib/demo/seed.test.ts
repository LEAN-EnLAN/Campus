import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadPortableCatalog } from '@/lib/backends/local/catalog'
import { LocalBackend } from '@/lib/backends/local/local-backend'
import { nodeCatalogReader } from '@/lib/backends/local/node-catalog'
import { memoryVaultAccess } from '@/lib/vault/memory-vault-access'

import { DEMO_ITEMS, relativeDate, seedDemo } from './seed'

async function demoBackend() {
  const catalog = await loadPortableCatalog(
    join(process.cwd(), 'public/academic-catalog'),
    nodeCatalogReader,
  )
  return new LocalBackend(memoryVaultAccess(), catalog)
}

const DAY = 24 * 60 * 60 * 1000

describe('demo seed', () => {
  it('is a UTN FRRo ISI Plan 2023 student, using only subjects of that plan', async () => {
    const backend = await demoBackend()
    const now = new Date(2026, 10, 19, 10, 0)
    await seedDemo(backend, now)

    const context = await backend.academic.context()
    expect(context?.programId).toBe('isi')
    expect(context?.curriculumId).toBe('utn/utn-frro/isi/Plan 2023')

    const bundle = await backend.catalog.curriculumBundle(context!.curriculumId!)
    const planIds = new Set(bundle.subjects.map((s) => s.id))
    const states = await backend.academic.subjectStates()
    expect(states.length).toBeGreaterThan(10)
    for (const state of states) expect(planIds.has(state.curriculumSubjectId)).toBe(true)

    // Every subject in course has its correlativas approved in the seed.
    const statusOf = new Map(states.map((s) => [s.curriculumSubjectId, s.status]))
    const inCourse = states.filter((s) => s.status === 'in_progress')
    expect(inCourse.length).toBeGreaterThanOrEqual(4)
    for (const state of inCourse) {
      const required = bundle.prerequisites.filter(
        (p) => p.curriculumSubjectId === state.curriculumSubjectId,
      )
      for (const edge of required) {
        expect(['passed', 'regularized', 'equivalent']).toContain(
          statusOf.get(edge.requiredCurriculumSubjectId),
        )
      }
    }
  })

  it('spreads deadlines around today: overdue, today, this week and the next two', async () => {
    const backend = await demoBackend()
    const now = new Date(2026, 10, 19, 10, 0)
    await seedDemo(backend, now)

    const items = await backend.items.list()
    expect(items).toHaveLength(DEMO_ITEMS.length)
    const open = items.filter((i) => i.status === 'open')
    const offsets = open.map((i) => (new Date(i.dueAt!).getTime() - now.getTime()) / DAY)
    expect(offsets.some((d) => d < 0)).toBe(true)
    expect(offsets.filter((d) => d >= 0 && d < 1).length).toBeGreaterThanOrEqual(2)
    expect(offsets.some((d) => d >= 1 && d < 7)).toBe(true)
    expect(offsets.some((d) => d >= 7 && d <= 14)).toBe(true)

    const resources = await backend.resources.list()
    expect(resources.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps an item due "today" ahead of the clock late in the day', () => {
    const late = new Date(2026, 10, 19, 22, 30)
    const due = new Date(relativeDate(late, 0, 18))
    expect(due.getTime()).toBeGreaterThan(late.getTime())
    expect(due.getDate()).toBe(19)
  })
})
