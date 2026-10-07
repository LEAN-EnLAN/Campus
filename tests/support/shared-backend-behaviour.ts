import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CampusBackend } from '@/lib/backends/types'

/**
 * DEV-15 / DEV-16 — the behaviours both adapters must answer identically.
 *
 * One suite, run against LocalBackend and the Supabase adapter (over an
 * in-memory PostgREST fake in `tests/unit`, over a real database in
 * `tests/db`). Ids and storage differ; what the student is told must not.
 */

export interface SharedFixture {
  name: string
  /** A fresh, empty store, and a backend over it. */
  open(): Promise<{
    backend: CampusBackend
    /** A new backend over the same store: persistence is never proven from memory. */
    reopen(): Promise<CampusBackend>
    /** Make the next write that creates a context fail, once. */
    failNextContextWrite(): void
  }>
  subjectId: string
}

const TODAY = new Date(2026, 9, 7, 13, 0, 0) // 7 Oct 2026, local

export function describeSharedBackendBehaviour(fixture: SharedFixture): void {
  describe(`shared behaviour — ${fixture.name}`, () => {
    let backend: CampusBackend
    let reopen: () => Promise<CampusBackend>
    let failNextContextWrite: () => void

    beforeEach(async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(TODAY)
      ;({ backend, reopen, failNextContextWrite } = await fixture.open())
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    const stateOf = async () =>
      (await reopen()).academic
        .subjectStates()
        .then((all) => all.find((s) => s.curriculumSubjectId === fixture.subjectId))

    describe('setSubjectStatus', () => {
      it('stores a grade, keeps it when the status changes, and clears it on null', async () => {
        const id = fixture.subjectId
        await backend.academic.setSubjectStatus({
          curriculumSubjectId: id,
          status: 'passed',
          grade: 8,
        })
        expect((await stateOf())?.grade).toBe(8)

        // No grade given: leave what is there.
        await backend.academic.setSubjectStatus({ curriculumSubjectId: id, status: 'passed' })
        expect((await stateOf())?.grade).toBe(8)

        // Explicit null: clear it. A grade that cannot be cleared is a wrong grade.
        await backend.academic.setSubjectStatus({
          curriculumSubjectId: id,
          status: 'passed',
          grade: null,
        })
        expect((await stateOf())?.grade).toBeNull()
      })

      it('sets completedAt to today for passed and equivalent, and clears it otherwise', async () => {
        const id = fixture.subjectId
        await backend.academic.setSubjectStatus({ curriculumSubjectId: id, status: 'passed' })
        expect((await stateOf())?.completedAt).toBe('2026-10-07')

        await backend.academic.setSubjectStatus({
          curriculumSubjectId: id,
          status: 'in_progress',
        })
        expect((await stateOf())?.completedAt).toBeNull()

        await backend.academic.setSubjectStatus({
          curriculumSubjectId: id,
          status: 'equivalent',
        })
        expect((await stateOf())?.completedAt).toBe('2026-10-07')

        await backend.academic.setSubjectStatus({
          curriculumSubjectId: id,
          status: 'regularized',
        })
        expect((await stateOf())?.completedAt).toBeNull()
      })

      it('null clears the row entirely', async () => {
        const id = fixture.subjectId
        await backend.academic.setSubjectStatus({
          curriculumSubjectId: id,
          status: 'passed',
          grade: 7,
        })
        await backend.academic.setSubjectStatus({ curriculumSubjectId: id, status: null })
        expect(await stateOf()).toBeUndefined()
      })
    })

    describe('trimming', () => {
      it('trims item titles and notes, and turns blank notes into null', async () => {
        const a = await backend.items.create({
          title: '  Parcial de Álgebra  ',
          kind: 'midterm',
          curriculumSubjectId: null,
          dueAt: null,
          notes: '  traer calculadora ',
        })
        const b = await backend.items.create({
          title: 'TP',
          kind: 'task',
          curriculumSubjectId: null,
          dueAt: null,
          notes: '   ',
        })
        const items = await (await reopen()).items.list()
        expect(items.find((i) => i.id === a.id)).toMatchObject({
          title: 'Parcial de Álgebra',
          notes: 'traer calculadora',
        })
        expect(items.find((i) => i.id === b.id)?.notes).toBeNull()
      })

      it('trims resource titles and links, and keeps only the field of its kind', async () => {
        const link = await backend.resources.create({
          title: '  Apunte  ',
          kind: 'link',
          curriculumSubjectId: null,
          url: '  https://example.org/a  ',
          body: 'ignored',
        })
        const note = await backend.resources.create({
          title: 'Fórmulas',
          kind: 'note',
          curriculumSubjectId: null,
          url: 'https://ignored.example',
          body: 'e = mc2',
        })
        const all = await (await reopen()).resources.list()
        expect(all.find((r) => r.id === link.id)).toMatchObject({
          title: 'Apunte',
          url: 'https://example.org/a',
          body: null,
        })
        expect(all.find((r) => r.id === note.id)).toMatchObject({
          title: 'Fórmulas',
          url: null,
          body: 'e = mc2',
        })
      })
    })

    describe('saveContext', () => {
      const ctx = (curriculumId: string | null, unmappedLabel: string | null = null) => ({
        institutionId: null,
        academicUnitId: null,
        programId: null,
        curriculumId,
        unmappedLabel,
      })

      it('replaces the active context', async () => {
        await backend.academic.saveContext(ctx('plan-a'))
        await backend.academic.saveContext(ctx('plan-b'))
        const active = await (await reopen()).academic.context()
        expect(active?.curriculumId).toBe('plan-b')
        expect(active?.isActive).toBe(true)
      })

      it('trims the label of an unmapped carrera', async () => {
        await backend.academic.saveContext(ctx(null, '  Psicología — UBA  '))
        expect((await (await reopen()).academic.context())?.unmappedLabel).toBe(
          'Psicología — UBA',
        )
      })

      it('a failed save leaves the previous context active', async () => {
        await backend.academic.saveContext(ctx('plan-a'))
        failNextContextWrite()

        await expect(backend.academic.saveContext(ctx('plan-b'))).rejects.toThrow()

        const active = await (await reopen()).academic.context()
        expect(active, 'the student was left without an active context').not.toBeNull()
        expect(active?.curriculumId).toBe('plan-a')
        expect(active?.isActive).toBe(true)
      })
    })
  })
}
