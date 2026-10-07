import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { LocalBackend } from '@/lib/backends/local/local-backend'
import type { PortableCatalog } from '@/lib/backends/local/catalog'
import { createSupabaseBackend } from '@/lib/backends/supabase-backend'
import type { CampusBackend } from '@/lib/backends/types'
import { nodeFileSystem } from '@/lib/vault/node-fs'
import { VaultRepository } from '@/lib/vault/vault-repository'

import { createFakeSupabase } from '../support/fake-supabase'

/**
 * "Cargar mi avance" and manual subjects: the behaviours both adapters must
 * answer identically. The in-memory PostgREST fake stands in for Postgres, so
 * RLS and constraints are NOT exercised here — see the migration test.
 */

const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

const emptyCatalog: PortableCatalog = { institutions: [], curricula: new Map() }

interface Fixture {
  name: string
  open(): { reopen(): CampusBackend; vaultRoot?: string }
}

const fixtures: Fixture[] = [
  {
    name: 'LocalBackend',
    open() {
      const base = mkdtempSync(join(tmpdir(), 'campus-manual-'))
      roots.push(base)
      const root = join(base, 'Campus')
      mkdirSync(root, { recursive: true })
      const vault = new VaultRepository(nodeFileSystem, root)
      return { reopen: () => new LocalBackend(vault, emptyCatalog), vaultRoot: root }
    },
  },
  {
    name: 'SupabaseBackend (in-memory PostgREST)',
    open() {
      const fake = createFakeSupabase()
      return { reopen: () => createSupabaseBackend(fake.client) }
    },
  },
]

describe.each(fixtures)('manual subjects and bulk status — $name', (fixture) => {
  let backend: CampusBackend
  let reopen: () => CampusBackend
  let vaultRoot: string | undefined

  beforeEach(() => {
    const opened = fixture.open()
    reopen = opened.reopen
    vaultRoot = opened.vaultRoot
    backend = reopen()
  })

  const add = (name = 'Cálculo 1', yearLevel = 1, term: 'anual' | '1c' | '2c' = '1c') =>
    backend.academic.addManualSubject({ name, yearLevel, term })

  describe('addManualSubject / manualSubjects', () => {
    it('starts empty', async () => {
      expect(await backend.academic.manualSubjects()).toEqual([])
    })

    it('trims the name, starts unmarked, and survives a reopen in creation order', async () => {
      const first = await add('  Cálculo 1  ', 1, '1c')
      await add('Física', 2, 'anual')

      expect(first).toMatchObject({
        name: 'Cálculo 1',
        yearLevel: 1,
        term: '1c',
        status: null,
        grade: null,
      })
      expect(first.id).toBeTruthy()

      const stored = await reopen().academic.manualSubjects()
      expect(stored.map((s) => s.name)).toEqual(['Cálculo 1', 'Física'])
    })

    it.each([
      ['a blank name', '   ', 1, /nombre/i],
      ['year 0', 'A', 0, /año/i],
      ['year 11', 'A', 11, /año/i],
    ])('refuses %s in Spanish and stores nothing', async (_label, name, year, message) => {
      await expect(add(name, year)).rejects.toThrow(message)
      expect(await reopen().academic.manualSubjects()).toEqual([])
    })
  })

  describe('status on a manual subject', () => {
    it('sets status and grade, keeps the grade when none is given, clears status on null', async () => {
      const { id } = await add()
      const set = (status: 'passed' | 'in_progress' | null, grade?: number | null) =>
        backend.academic.setSubjectStatus({
          curriculumSubjectId: id,
          manual: true,
          status,
          ...(grade === undefined ? {} : { grade }),
        })
      const current = async () => (await reopen().academic.manualSubjects())[0]

      await set('passed', 8)
      expect(await current()).toMatchObject({ status: 'passed', grade: 8 })

      await set('in_progress')
      expect(await current()).toMatchObject({ status: 'in_progress', grade: 8 })

      await set(null)
      // Clearing the status returns the subject to "Sin marcar"; it does not delete it.
      expect(await current()).toMatchObject({ id, status: null })
    })

    it('never leaks into the catalog subject states', async () => {
      const { id } = await add()
      await backend.academic.setSubjectStatus({
        curriculumSubjectId: id,
        manual: true,
        status: 'passed',
      })
      expect(await reopen().academic.subjectStates()).toEqual([])
    })

    it('says so when the subject does not exist, instead of silently doing nothing', async () => {
      await expect(
        backend.academic.setSubjectStatus({
          curriculumSubjectId: 'nope',
          manual: true,
          status: 'passed',
        }),
      ).rejects.toThrow(/materia/i)
    })
  })

  describe('setSubjectStatuses (bulk)', () => {
    it('writes many catalog subjects in one call and keeps what is already there', async () => {
      await backend.academic.setSubjectStatus({
        curriculumSubjectId: 'a',
        status: 'in_progress',
        grade: 6,
      })

      await backend.academic.setSubjectStatuses([
        { curriculumSubjectId: 'a', status: 'passed' },
        { curriculumSubjectId: 'b', status: 'passed' },
        { curriculumSubjectId: 'c', status: 'equivalent' },
      ])

      const states = await reopen().academic.subjectStates()
      const by = new Map(states.map((s) => [s.curriculumSubjectId, s]))
      expect(by.get('a')).toMatchObject({ status: 'passed', grade: 6 })
      expect(by.get('b')?.status).toBe('passed')
      expect(by.get('c')?.status).toBe('equivalent')
      expect(by.get('b')?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('null in a bulk write clears that subject (this is how Deshacer works)', async () => {
      await backend.academic.setSubjectStatuses([
        { curriculumSubjectId: 'a', status: 'passed' },
        { curriculumSubjectId: 'b', status: 'passed' },
      ])
      await backend.academic.setSubjectStatuses([
        { curriculumSubjectId: 'a', status: null },
        { curriculumSubjectId: 'b', status: 'in_progress' },
      ])
      const states = await reopen().academic.subjectStates()
      expect(states.map((s) => [s.curriculumSubjectId, s.status])).toEqual([
        ['b', 'in_progress'],
      ])
    })

    it('does nothing for an empty batch', async () => {
      await backend.academic.setSubjectStatuses([])
      expect(await reopen().academic.subjectStates()).toEqual([])
    })

    it('writes many manual subjects in one call', async () => {
      const a = await add('A')
      const b = await add('B')
      await backend.academic.setSubjectStatuses([
        { curriculumSubjectId: a.id, manual: true, status: 'passed' },
        { curriculumSubjectId: b.id, manual: true, status: 'regularized' },
      ])
      const stored = await reopen().academic.manualSubjects()
      expect(stored.map((s) => s.status)).toEqual(['passed', 'regularized'])
    })

    it('refuses a batch that mixes catalog and manual subjects', async () => {
      const { id } = await add()
      await expect(
        backend.academic.setSubjectStatuses([
          { curriculumSubjectId: id, manual: true, status: 'passed' },
          { curriculumSubjectId: 'a', status: 'passed' },
        ]),
      ).rejects.toThrow(/mezclar|juntas/i)
      expect(await reopen().academic.subjectStates()).toEqual([])
      expect((await reopen().academic.manualSubjects())[0]?.status).toBeNull()
    })
  })

  describe('removeManualSubject', () => {
    it('removes only that subject and is quiet about one that is already gone', async () => {
      const a = await add('A')
      await add('B')
      await backend.academic.removeManualSubject(a.id)
      await backend.academic.removeManualSubject(a.id)
      expect((await reopen().academic.manualSubjects()).map((s) => s.name)).toEqual(['B'])
    })
  })

  describe('entregas and material on a manual subject', () => {
    it('keep their subject across a reopen', async () => {
      const { id } = await add()
      await backend.items.create({
        title: 'TP 1',
        kind: 'task',
        curriculumSubjectId: id,
        dueAt: null,
      })
      await backend.resources.create({
        title: 'Apunte',
        kind: 'link',
        curriculumSubjectId: id,
        url: 'https://example.org',
        body: null,
      })
      const again = reopen()
      expect((await again.items.list())[0]?.curriculumSubjectId).toBe(id)
      expect((await again.resources.list())[0]?.curriculumSubjectId).toBe(id)
    })

    it('still link catalog subjects as before', async () => {
      await backend.items.create({
        title: 'TP 2',
        kind: 'task',
        curriculumSubjectId: 'catalog-1',
        dueAt: null,
      })
      expect((await reopen().items.list())[0]?.curriculumSubjectId).toBe('catalog-1')
    })
  })

  if (fixture.name === 'LocalBackend') {
    it('keeps manual subjects in their own readable file, with a schemaVersion', async () => {
      await add('Cálculo 1')
      const raw = readFileSync(
        join(vaultRoot!, '.campus/academic/manual-subjects.json'),
        'utf8',
      )
      const parsed = JSON.parse(raw) as { schemaVersion: number; subjects: { name: string }[] }
      expect(parsed.schemaVersion).toBe(1)
      expect(parsed.subjects.map((s) => s.name)).toEqual(['Cálculo 1'])
      expect(raw).toContain('\n')
    })
  }
})
