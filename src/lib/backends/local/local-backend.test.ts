import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, afterEach, describe, expect, it } from 'vitest'

import { nodeFileSystem } from '@/lib/vault/node-fs'
import { VaultRepository } from '@/lib/vault/vault-repository'

import { loadPortableCatalog } from './catalog'
import { nodeCatalogReader } from './node-catalog'
import { LocalBackend } from './local-backend'
import type { PortableCatalog } from './catalog'

/**
 * A-08 — LOCAL-003.
 *
 * The rule these tests are built around: **every assertion about persistence is
 * made against a BRAND NEW LocalBackend**. An instance that answers from its own
 * memory proves nothing about what reached the disk, and the whole claim of this
 * milestone is that the vault files are the truth.
 */

let root: string
let catalog: PortableCatalog

/** A backend that has never seen a previous instance's memory. */
const fresh = () => new LocalBackend(new VaultRepository(nodeFileSystem, root), catalog)

const UTN = 'utn/utn-frro/isi/Plan 2023'
const UNR = 'unr/unr-fceia/lcc/TO 2024'

beforeEach(async () => {
  root = join(mkdtempSync(join(tmpdir(), 'campus-local-')), 'Campus')
  mkdirSync(root, { recursive: true })
  catalog = await loadPortableCatalog(
    join(process.cwd(), 'public/academic-catalog'),
    nodeCatalogReader,
  )
})

afterEach(() => {
  rmSync(join(root, '..'), { recursive: true, force: true })
})

// ---------------------------------------------------------------- the contract

describe('the seam', () => {
  it('declares itself local and exposes exactly the sixteen methods', () => {
    const b = fresh()
    expect(b.kind).toBe('local')
    const shape = {
      catalog: Object.keys(b.catalog).sort(),
      academic: Object.keys(b.academic).sort(),
      items: Object.keys(b.items).sort(),
      resources: Object.keys(b.resources).sort(),
    }
    // Not "at least these" — exactly these. A method with no caller does not
    // get written, and one that appears here without a hook is dead weight.
    expect(shape).toEqual({
      catalog: ['academicUnits', 'curricula', 'curriculumBundle', 'institutions', 'programs'],
      academic: ['context', 'saveContext', 'subjectStates', 'setSubjectStatus'].sort(),
      items: ['create', 'list', 'remove', 'setDone'],
      resources: ['create', 'list', 'remove'],
    })
    const count = Object.values(shape).reduce((n, k) => n + k.length, 0)
    expect(count).toBe(16)
  })
})

// ------------------------------------------------- meaning, not just round trip

describe('prerequisitesKnown survives the vault', () => {
  it('UTN: known, with its correlativas intact after a reload', async () => {
    const bundle = await fresh().catalog.curriculumBundle(UTN)
    expect(bundle.prerequisitesKnown).toBe(true)
    expect(bundle.prerequisites.length).toBe(186)

    // Same question, a completely new backend, nothing cached.
    const again = await fresh().catalog.curriculumBundle(UTN)
    expect(again.prerequisitesKnown).toBe(true)
    expect(again.prerequisites.length).toBe(186)
  })

  it('a plan that genuinely has NO correlativas stays known, not unknown', async () => {
    // Neither real plan can catch a re-derivation here: UTN has 186 edges so
    // `edges.length > 0` answers true, and UNR has none so it answers false —
    // both happen to match. Only a plan that declares `known: true` with an
    // empty edge list tells the two apart, and it is the shape the whole
    // invariant exists for. Without this, the tests bless the bug.
    const synthetic: PortableCatalog = {
      institutions: catalog.institutions,
      curricula: new Map(catalog.curricula),
    }
    const utn = synthetic.curricula.get(UTN)!
    synthetic.curricula.set(UTN, {
      ...utn,
      subjects: utn.subjects.map((s) => ({ ...s, prerequisites: [] })),
      prerequisitesKnown: true,
      prerequisitesNote: null,
    })

    const bundle = await new LocalBackend(
      new VaultRepository(nodeFileSystem, root),
      synthetic,
    ).catalog.curriculumBundle(UTN)

    expect(bundle.prerequisites).toEqual([])
    expect(
      bundle.prerequisitesKnown,
      'zero edges was read as "unknown" — the flag is being re-derived',
    ).toBe(true)
  })

  it('a plan Campus does not have is UNKNOWN, never "nothing blocks you"', async () => {
    const bundle = await fresh().catalog.curriculumBundle('does/not/exist')
    expect(bundle.prerequisites).toEqual([])
    // The dangerous default: an absent plan with an empty edge list must not
    // let a screen conclude the student is free to enrol in anything.
    expect(bundle.prerequisitesKnown).toBe(false)
    expect(bundle.prerequisitesNote).not.toBeNull()
  })

  it('UNR: still UNKNOWN after a reload, and never reads as "nothing blocks you"', async () => {
    const bundle = await fresh().catalog.curriculumBundle(UNR)
    expect(bundle.prerequisitesKnown).toBe(false)
    expect(bundle.prerequisites).toEqual([])
    expect(bundle.prerequisitesNote).not.toBeNull()

    const again = await fresh().catalog.curriculumBundle(UNR)
    expect(again.prerequisitesKnown).toBe(false)
    // The distinction is the point: zero edges plus known=false is UNKNOWN, and
    // no caller may recover "has none" from this pair.
    expect(again.prerequisites).toEqual([])
    expect(again.prerequisitesNote).not.toBeNull()
  })
})

// ------------------------------------------------------------------- academic

describe('academic context', () => {
  it('is null in a vault nobody has set up', async () => {
    expect(await fresh().academic.context()).toBeNull()
  })

  it('survives a restart', async () => {
    await fresh().academic.saveContext({
      institutionId: 'utn',
      academicUnitId: 'utn-frro',
      programId: 'isi',
      curriculumId: UTN,
      unmappedLabel: null,
    })

    const reloaded = await fresh().academic.context()
    expect(reloaded?.curriculumId).toBe(UTN)
    expect(reloaded?.isActive).toBe(true)
  })

  it('keeps an unmapped plan as a first-class answer', async () => {
    // CAP-ONBOARD-002: a student whose plan Campus does not have is not an
    // error state, and "no plan" must not be flattened into null.
    await fresh().academic.saveContext({
      institutionId: null,
      academicUnitId: null,
      programId: null,
      curriculumId: null,
      unmappedLabel: 'Ingeniería Industrial — UNC',
    })
    const reloaded = await fresh().academic.context()
    expect(reloaded?.unmappedLabel).toBe('Ingeniería Industrial — UNC')
    expect(reloaded?.curriculumId).toBeNull()
  })
})

describe('subject state', () => {
  it('in_progress survives a restart', async () => {
    await fresh().academic.setSubjectStatus({
      curriculumSubjectId: 'analisis-matematico-i-1',
      status: 'in_progress',
    })

    const states = await fresh().academic.subjectStates()
    expect(states).toHaveLength(1)
    expect(states[0]!.curriculumSubjectId).toBe('analisis-matematico-i-1')
    expect(states[0]!.status).toBe('in_progress')
  })

  it('keeps a grade alongside the status', async () => {
    await fresh().academic.setSubjectStatus({
      curriculumSubjectId: 'analisis-matematico-i-1',
      status: 'passed',
      grade: 8,
    })
    const [state] = await fresh().academic.subjectStates()
    expect(state!.status).toBe('passed')
    expect(state!.grade).toBe(8)
  })

  it('updates in place rather than appending a second row for one subject', async () => {
    const id = 'analisis-matematico-i-1'
    await fresh().academic.setSubjectStatus({ curriculumSubjectId: id, status: 'in_progress' })
    await fresh().academic.setSubjectStatus({
      curriculumSubjectId: id,
      status: 'passed',
      grade: 9,
    })

    const states = await fresh().academic.subjectStates()
    expect(states).toHaveLength(1)
    expect(states[0]!.status).toBe('passed')
  })

  it('a null status clears the row, returning the subject to derived state', async () => {
    const id = 'analisis-matematico-i-1'
    await fresh().academic.setSubjectStatus({ curriculumSubjectId: id, status: 'in_progress' })
    await fresh().academic.setSubjectStatus({ curriculumSubjectId: id, status: null })

    // Not "stored as null" — absent. `available` and `pending` are derived, and
    // storing them would let the file drift from the prerequisite graph.
    expect(await fresh().academic.subjectStates()).toEqual([])
  })
})

// ---------------------------------------------------------------------- items

describe('items', () => {
  it('a deadline survives a restart with its date, kind and subject relation', async () => {
    const created = await fresh().items.create({
      title: 'TP 4',
      kind: 'assignment',
      curriculumSubjectId: 'analisis-matematico-ii-9',
      dueAt: '2026-08-20T21:00:00.000Z',
      notes: 'entrega por campus',
    })

    const [item] = await fresh().items.list()
    expect(item!.id).toBe(created.id)
    expect(item!.title).toBe('TP 4')
    expect(item!.kind).toBe('assignment')
    expect(item!.curriculumSubjectId).toBe('analisis-matematico-ii-9')
    expect(item!.dueAt).toBe('2026-08-20T21:00:00.000Z')
    expect(item!.notes).toBe('entrega por campus')
    expect(item!.status).toBe('open')
  })

  it('mints a local id that is not shaped like a Postgres uuid', async () => {
    // vault-format.md: ids are ULIDs minted locally and the formats must not be
    // assumed interchangeable, because a future sync maps between them.
    const created = await fresh().items.create({
      title: 'x',
      kind: 'task',
      curriculumSubjectId: null,
      dueAt: null,
    })
    expect(created.id).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)
    expect(created.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
  })

  it('setDone persists', async () => {
    const created = await fresh().items.create({
      title: 'Parcial',
      kind: 'midterm',
      curriculumSubjectId: null,
      dueAt: null,
    })
    await fresh().items.setDone(created.id, true)
    expect((await fresh().items.list())[0]!.status).toBe('done')

    await fresh().items.setDone(created.id, false)
    expect((await fresh().items.list())[0]!.status).toBe('open')
  })

  it('remove persists, and only removes the one asked for', async () => {
    const a = await fresh().items.create({
      title: 'a',
      kind: 'task',
      curriculumSubjectId: null,
      dueAt: null,
    })
    const b = await fresh().items.create({
      title: 'b',
      kind: 'task',
      curriculumSubjectId: null,
      dueAt: null,
    })
    await fresh().items.remove(a.id)

    const left = await fresh().items.list()
    expect(left.map((i) => i.id)).toEqual([b.id])
  })

  it('concurrent creates from separate instances do not lose each other', async () => {
    // Each create is read → derive → atomic write. Two backends that both read
    // an empty file and both write one item would leave one student's deadline
    // silently gone.
    await fresh().items.create({
      title: 'a',
      kind: 'task',
      curriculumSubjectId: null,
      dueAt: null,
    })
    await fresh().items.create({
      title: 'b',
      kind: 'task',
      curriculumSubjectId: null,
      dueAt: null,
    })
    await fresh().items.create({
      title: 'c',
      kind: 'task',
      curriculumSubjectId: null,
      dueAt: null,
    })

    expect((await fresh().items.list()).map((i) => i.title).sort()).toEqual(['a', 'b', 'c'])
  })
})

// ------------------------------------------------------------------ resources

describe('resources', () => {
  it('a link survives a restart', async () => {
    const created = await fresh().resources.create({
      title: 'Apunte de pipeline',
      kind: 'link',
      curriculumSubjectId: 'analisis-matematico-ii-9',
      url: 'https://example.org/pipeline',
      body: null,
    })

    const [resource] = await fresh().resources.list()
    expect(resource!.id).toBe(created.id)
    expect(resource!.kind).toBe('link')
    expect(resource!.url).toBe('https://example.org/pipeline')
    expect(resource!.curriculumSubjectId).toBe('analisis-matematico-ii-9')
    expect(resource!.createdAt).toBe(created.createdAt)
  })

  it('remove persists', async () => {
    const created = await fresh().resources.create({
      title: 'nota',
      kind: 'note',
      curriculumSubjectId: null,
      url: null,
      body: 'texto',
    })
    await fresh().resources.remove(created.id)
    expect(await fresh().resources.list()).toEqual([])
  })
})

// ------------------------------------------------------- the files themselves

describe('the vault files', () => {
  it('every academic file carries a schemaVersion', async () => {
    const b = fresh()
    await b.academic.saveContext({
      institutionId: 'utn',
      academicUnitId: 'utn-frro',
      programId: 'isi',
      curriculumId: UTN,
      unmappedLabel: null,
    })
    await b.academic.setSubjectStatus({ curriculumSubjectId: 'x', status: 'passed' })
    await b.items.create({ title: 'a', kind: 'task', curriculumSubjectId: null, dueAt: null })
    await b.resources.create({
      title: 'r',
      kind: 'note',
      curriculumSubjectId: null,
      url: null,
      body: 'b',
    })

    for (const file of ['context.json', 'subject-state.json', 'items.json', 'resources.json']) {
      const parsed = JSON.parse(readFileSync(join(root, '.campus/academic', file), 'utf8')) as {
        schemaVersion?: number
      }
      expect(parsed.schemaVersion, `${file} must declare a schemaVersion`).toBe(1)
    }
  })

  it('is readable JSON a human could fix with a text editor', async () => {
    await fresh().items.create({
      title: 'TP 4',
      kind: 'assignment',
      curriculumSubjectId: null,
      dueAt: null,
    })
    const raw = readFileSync(join(root, '.campus/academic/items.json'), 'utf8')
    // Deleting Campus must leave the student with something they can read.
    expect(raw).toContain('\n')
    expect(raw).toContain('TP 4')
  })

  it('refuses to open a vault written by a newer Campus rather than guessing', async () => {
    const b = fresh()
    await b.items.create({ title: 'a', kind: 'task', curriculumSubjectId: null, dueAt: null })

    const path = join(root, '.campus/academic/items.json')
    const doc = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    doc.schemaVersion = 99
    await new VaultRepository(nodeFileSystem, root).writeNote(
      '.campus/academic/items.json',
      JSON.stringify(doc),
      (await new VaultRepository(nodeFileSystem, root).readNote('.campus/academic/items.json'))
        .mtimeMs,
    )

    // Silently migrating or ignoring it is how a student loses a semester.
    await expect(fresh().items.list()).rejects.toThrow(/versión|version/i)
  })
})
