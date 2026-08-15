import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadPortableCatalog, type PortableCatalog } from '@/lib/backends/local/catalog'
import { LocalBackend } from '@/lib/backends/local/local-backend'
import { nodeCatalogReader } from '@/lib/backends/local/node-catalog'
import { createSupabaseBackend } from '@/lib/backends/supabase-backend'
import type { CampusBackend } from '@/lib/backends/types'
import { nodeFileSystem } from '@/lib/vault/node-fs'
import { VaultRepository } from '@/lib/vault/vault-repository'

/**
 * A-10 — one semantic contract, two implementations.
 *
 * The ADR names behavioural drift between adapters as its main risk. Two
 * implementations tested separately will diverge; this is the suite that has to
 * see it happen.
 *
 * It asserts CONTRACT equality, not implementation equality. Ids differ (ULIDs
 * locally, uuids in Postgres), reference data is addressed by slug locally and
 * by uuid in the cloud, and neither is a defect. What must match is what the
 * student is told.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''

let catalog: PortableCatalog
let cloudClient: SupabaseClient
let vaultRoot: string

/** Reference ids differ per adapter; the CONTRACT does not. */
interface Fixture {
  name: string
  backend(): Promise<CampusBackend>
  /** A fresh instance over the same store. Local persistence may not be proven from memory. */
  reopen(): Promise<CampusBackend>
  curriculumId: string
  utnId: string
  unrId: string
  subjectId: string
}

beforeAll(async () => {
  catalog = await loadPortableCatalog(
    join(process.cwd(), 'public/academic-catalog'),
    nodeCatalogReader,
  )

  vaultRoot = join(mkdtempSync(join(tmpdir(), 'campus-conformance-')), 'Campus')
  mkdirSync(vaultRoot, { recursive: true })

  cloudClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const email = `conformance-${Date.now()}@campus.test`
  const { error } = await cloudClient.auth.signUp({ email, password: 'campus-conformance' })
  if (error) throw new Error(`signUp failed: ${error.message}`)
}, 60_000)

afterAll(() => {
  rmSync(join(vaultRoot, '..'), { recursive: true, force: true })
})

const localVault = () => new VaultRepository(nodeFileSystem, vaultRoot)

async function cloudIds() {
  const { data } = await cloudClient
    .from('curricula')
    .select('id, version, prerequisites_known')
    .order('version')
  const rows = (data ?? []) as { id: string; version: string }[]
  const utn = rows.find((r) => r.version === 'Plan 2023')!
  const unr = rows.find((r) => r.version === 'TO 2024')!
  const { data: subjects } = await cloudClient
    .from('curriculum_subjects')
    .select('id')
    .eq('curriculum_id', utn.id)
    .limit(1)
  return { utn: utn.id, unr: unr.id, subject: (subjects ?? [])[0]!.id as string }
}

describe('A-10 — both adapters answer the same contract', () => {
  let fixtures: Fixture[]

  beforeAll(async () => {
    const ids = await cloudIds()
    fixtures = [
      {
        name: 'LocalBackend',
        backend: async () => new LocalBackend(localVault(), catalog),
        // A brand new backend over a brand new repository. No in-memory state
        // may be what proves persistence.
        reopen: async () => new LocalBackend(localVault(), catalog),
        curriculumId: 'utn/utn-frro/isi/Plan 2023',
        utnId: 'utn/utn-frro/isi/Plan 2023',
        unrId: 'unr/unr-fceia/lcc/TO 2024',
        subjectId: 'analisis-matematico-i-1',
      },
      {
        name: 'SupabaseBackend',
        backend: async () => createSupabaseBackend(cloudClient),
        reopen: async () => createSupabaseBackend(cloudClient),
        curriculumId: ids.utn,
        utnId: ids.utn,
        unrId: ids.unr,
        subjectId: ids.subject,
      },
    ]
  }, 60_000)

  it('both expose exactly the sixteen methods', async () => {
    for (const fixture of fixtures) {
      const b = await fixture.backend()
      const count =
        Object.keys(b.catalog).length +
        Object.keys(b.academic).length +
        Object.keys(b.items).length +
        Object.keys(b.resources).length
      expect(count, `${fixture.name} exposes ${count} methods`).toBe(16)
    }
  })

  // --- catalog: 5 methods ---------------------------------------------------

  it('catalog.institutions / academicUnits / programs / curricula answer', async () => {
    for (const fixture of fixtures) {
      const b = await fixture.backend()
      const institutions = await b.catalog.institutions()
      expect(institutions.length, fixture.name).toBeGreaterThanOrEqual(2)

      const unit = await b.catalog.academicUnits(institutions[0]!.id)
      expect(unit.length, `${fixture.name} academicUnits`).toBeGreaterThanOrEqual(1)

      const programs = await b.catalog.programs(unit[0]!.id)
      expect(programs.length, `${fixture.name} programs`).toBeGreaterThanOrEqual(1)

      const curricula = await b.catalog.curricula(programs[0]!.id)
      expect(curricula.length, `${fixture.name} curricula`).toBeGreaterThanOrEqual(1)
    }
  })

  // --- the epistemic cases, which are the reason this suite exists ----------

  it('UTN: known, with real edges — identically in both', async () => {
    for (const fixture of fixtures) {
      const bundle = await (await fixture.backend()).catalog.curriculumBundle(fixture.utnId)
      expect(bundle.prerequisitesKnown, `${fixture.name} UTN known`).toBe(true)
      expect(bundle.prerequisitesNote, `${fixture.name} UTN note`).toBeNull()
      expect(bundle.prerequisites.length, `${fixture.name} UTN edges`).toBe(186)
      expect(bundle.subjects.length, `${fixture.name} UTN subjects`).toBe(40)
    }
  })

  it('UNR: UNKNOWN with zero edges — identically in both, and never "unblocked"', async () => {
    for (const fixture of fixtures) {
      const bundle = await (await fixture.backend()).catalog.curriculumBundle(fixture.unrId)
      expect(bundle.prerequisitesKnown, `${fixture.name} UNR known`).toBe(false)
      expect(bundle.prerequisites, `${fixture.name} UNR edges`).toEqual([])
      // The note is what the student reads. Without it the screen has a true
      // flag and nothing to say.
      expect(bundle.prerequisitesNote, `${fixture.name} UNR note`).not.toBeNull()
    }
  })

  it('a missing curriculum is UNKNOWN in both, never implicitly unblocked', async () => {
    for (const fixture of fixtures) {
      const b = await fixture.backend()
      const bundle = await b.catalog.curriculumBundle(
        fixture.name === 'LocalBackend'
          ? 'does/not/exist'
          : '00000000-0000-0000-0000-000000000000',
      )
      expect(bundle.prerequisites, `${fixture.name} missing edges`).toEqual([])
      expect(bundle.prerequisitesKnown, `${fixture.name} missing known`).toBe(false)
    }
  })

  it('KNOWN-EMPTY differs from UNKNOWN — the case that kills the inference', async () => {
    // `edges.length > 0` cannot produce this row, which is why it is the only
    // fixture that detects the inference coming back. Local-only because it is
    // a synthetic plan, not institutional reference data.
    const synthetic: PortableCatalog = {
      institutions: catalog.institutions,
      curricula: new Map(catalog.curricula),
    }
    const utn = synthetic.curricula.get('utn/utn-frro/isi/Plan 2023')!
    synthetic.curricula.set('utn/utn-frro/isi/Plan 2023', {
      ...utn,
      subjects: utn.subjects.map((s) => ({ ...s, prerequisites: [] })),
      prerequisitesKnown: true,
      prerequisitesNote: null,
    })

    const knownEmpty = await new LocalBackend(localVault(), synthetic).catalog.curriculumBundle(
      'utn/utn-frro/isi/Plan 2023',
    )
    const unknown = await new LocalBackend(localVault(), catalog).catalog.curriculumBundle(
      'unr/unr-fceia/lcc/TO 2024',
    )

    expect(knownEmpty.prerequisites).toEqual([])
    expect(unknown.prerequisites).toEqual([])
    // Same edges, different meaning. That is the whole invariant.
    expect(knownEmpty.prerequisitesKnown).toBe(true)
    expect(unknown.prerequisitesKnown).toBe(false)
  })

  // --- academic: 4 methods --------------------------------------------------

  it('academic.context is null before anything is saved, in both', async () => {
    for (const fixture of fixtures) {
      expect(await (await fixture.backend()).academic.context(), fixture.name).toBeNull()
    }
  })

  it('academic.saveContext then context() survives a NEW instance', async () => {
    for (const fixture of fixtures) {
      const b = await fixture.backend()
      const institutions = await b.catalog.institutions()
      const units = await b.catalog.academicUnits(institutions[0]!.id)
      const programs = await b.catalog.programs(units[0]!.id)

      await b.academic.saveContext({
        institutionId: institutions[0]!.id,
        academicUnitId: units[0]!.id,
        programId: programs[0]!.id,
        curriculumId: fixture.curriculumId,
        unmappedLabel: null,
      })

      const reloaded = await (await fixture.reopen()).academic.context()
      expect(reloaded, `${fixture.name} context`).not.toBeNull()
      expect(reloaded!.curriculumId, `${fixture.name} curriculumId`).toBe(fixture.curriculumId)
      expect(reloaded!.isActive, `${fixture.name} isActive`).toBe(true)
    }
  })

  it('academic.setSubjectStatus / subjectStates survive a NEW instance', async () => {
    for (const fixture of fixtures) {
      const b = await fixture.backend()
      await b.academic.setSubjectStatus({
        curriculumSubjectId: fixture.subjectId,
        status: 'in_progress',
      })

      const states = await (await fixture.reopen()).academic.subjectStates()
      const state = states.find((s) => s.curriculumSubjectId === fixture.subjectId)
      expect(state, `${fixture.name} state`).toBeDefined()
      expect(state!.status, `${fixture.name} status`).toBe('in_progress')
    }
  })

  it('a status update replaces rather than duplicating, in both', async () => {
    for (const fixture of fixtures) {
      const b = await fixture.backend()
      await b.academic.setSubjectStatus({
        curriculumSubjectId: fixture.subjectId,
        status: 'passed',
        grade: 9,
      })

      const states = await (await fixture.reopen()).academic.subjectStates()
      const matching = states.filter((s) => s.curriculumSubjectId === fixture.subjectId)
      expect(matching.length, `${fixture.name} duplicated the subject`).toBe(1)
      expect(matching[0]!.status, fixture.name).toBe('passed')
      expect(matching[0]!.grade, fixture.name).toBe(9)
    }
  })

  it('a null status CLEARS the row rather than storing a placeholder', async () => {
    for (const fixture of fixtures) {
      const b = await fixture.backend()
      await b.academic.setSubjectStatus({
        curriculumSubjectId: fixture.subjectId,
        status: null,
      })

      const states = await (await fixture.reopen()).academic.subjectStates()
      // `available` and `pending` are derived from the prerequisite graph.
      // A stored placeholder would let the store drift from the graph.
      expect(
        states.find((s) => s.curriculumSubjectId === fixture.subjectId),
        `${fixture.name} kept a cleared subject`,
      ).toBeUndefined()
    }
  })

  // --- items: 4 methods -----------------------------------------------------

  it('items.create / list round-trip a deadline through a NEW instance', async () => {
    for (const fixture of fixtures) {
      const b = await fixture.backend()
      const dueAt = '2026-08-20T21:00:00.000Z'
      const created = await b.items.create({
        title: 'TP conformance',
        kind: 'assignment',
        curriculumSubjectId: fixture.subjectId,
        dueAt,
        notes: 'nota',
      })

      const found = (await (await fixture.reopen()).items.list()).find(
        (i) => i.id === created.id,
      )
      expect(found, `${fixture.name} item`).toBeDefined()
      expect(found!.title, fixture.name).toBe('TP conformance')
      expect(found!.kind, fixture.name).toBe('assignment')
      expect(found!.status, fixture.name).toBe('open')
      // Dates must survive as the same instant, whatever each store does
      // internally. A timezone shift here is a deadline on the wrong day.
      expect(new Date(found!.dueAt!).toISOString(), `${fixture.name} dueAt`).toBe(dueAt)
      expect(found!.curriculumSubjectId, fixture.name).toBe(fixture.subjectId)
    }
  })

  it('items.setDone and remove persist through a NEW instance', async () => {
    for (const fixture of fixtures) {
      const b = await fixture.backend()
      const created = await b.items.create({
        title: 'to close',
        kind: 'task',
        curriculumSubjectId: null,
        dueAt: null,
      })

      await b.items.setDone(created.id, true)
      let found = (await (await fixture.reopen()).items.list()).find((i) => i.id === created.id)
      expect(found!.status, `${fixture.name} setDone`).toBe('done')

      await b.items.setDone(created.id, false)
      found = (await (await fixture.reopen()).items.list()).find((i) => i.id === created.id)
      expect(found!.status, `${fixture.name} undone`).toBe('open')

      await b.items.remove(created.id)
      found = (await (await fixture.reopen()).items.list()).find((i) => i.id === created.id)
      expect(found, `${fixture.name} remove`).toBeUndefined()
    }
  })

  // --- resources: 3 methods -------------------------------------------------

  it('resources.create / list / remove persist through a NEW instance', async () => {
    for (const fixture of fixtures) {
      const b = await fixture.backend()
      const created = await b.resources.create({
        title: 'Apunte',
        kind: 'link',
        curriculumSubjectId: fixture.subjectId,
        url: 'https://example.org/apunte',
        body: null,
      })

      let found = (await (await fixture.reopen()).resources.list()).find(
        (r) => r.id === created.id,
      )
      expect(found, `${fixture.name} resource`).toBeDefined()
      expect(found!.kind, fixture.name).toBe('link')
      expect(found!.url, fixture.name).toBe('https://example.org/apunte')

      await b.resources.remove(created.id)
      found = (await (await fixture.reopen()).resources.list()).find((r) => r.id === created.id)
      expect(found, `${fixture.name} remove`).toBeUndefined()
    }
  })
})
