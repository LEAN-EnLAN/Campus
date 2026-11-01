import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { VaultError } from '@/lib/vault/errors'
import { nodeFileSystem } from '@/lib/vault/node-fs'
import { VaultRepository } from '@/lib/vault/vault-repository'

import { LocalBackend } from './local-backend'

let root: string
let vault: VaultRepository
let backend: LocalBackend
const context = {
  institutionId: null,
  academicUnitId: null,
  programId: null,
  curriculumId: null,
  unmappedLabel: 'My degree',
}
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'campus-academic-read-')))
  vault = new VaultRepository(nodeFileSystem, root)
  backend = new LocalBackend(vault, { institutions: [], curricula: new Map() })
})
afterEach(() => {
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

describe('LocalBackend academic read failures', () => {
  const errors = [
    ...(
      [
        'permission_denied',
        'unavailable',
        'outside_vault',
        'root_unreadable',
        'io_error',
      ] as const
    ).map((code) => new VaultError(code)),
    Object.assign(new Error('untyped absence is not authoritative'), { code: 'not_found' }),
    Object.assign(new Error('native read failure'), { code: 'EACCES' }),
  ]
  it.each(errors)(
    'propagates %s from every read and refuses every derived write',
    async (error) => {
      vi.spyOn(vault, 'readNote').mockRejectedValue(error)
      const writes = vi.spyOn(vault, 'writeNote')
      const outcomes = await Promise.allSettled([
        backend.academic.context(),
        backend.academic.subjectStates(),
        backend.academic.manualSubjects(),
        backend.items.list(),
        backend.resources.list(),
        backend.academic.saveContext(context),
        backend.academic.setSubjectStatus({
          curriculumSubjectId: 'subject',
          status: 'in_progress',
        }),
        backend.academic.removeManualSubject('subject'),
        backend.items.remove('item'),
        backend.resources.remove('resource'),
      ])
      expect(outcomes).toEqual(
        Array.from({ length: 10 }, () => ({ status: 'rejected', reason: error })),
      )
      expect(writes).not.toHaveBeenCalled()
      expect(readdirSync(root)).toEqual([])
    },
  )

  it('allows typed not_found in a fresh vault and persists its first context', async () => {
    expect(await backend.academic.context()).toBeNull()
    expect(await backend.items.list()).toEqual([])
    await backend.academic.saveContext(context)
    const reopened = new LocalBackend(new VaultRepository(nodeFileSystem, root), {
      institutions: [],
      curricula: new Map(),
    })
    expect(await reopened.academic.context()).toMatchObject({ unmappedLabel: 'My degree' })
  })

  it.each([
    null,
    [],
    'text',
    1,
    {},
    { schemaVersion: '1', items: [] },
    { schemaVersion: 0, items: [] },
    { schemaVersion: 1.5, items: [] },
    { schemaVersion: 1, items: null },
    { schemaVersion: 1, items: {} },
    { schemaVersion: 1 },
  ])('rejects malformed envelope %j without overwriting it', async (envelope) => {
    const path = '.campus/academic/items.json'
    const contents = JSON.stringify(envelope)
    await vault.writeNote(path, contents, null)
    await expect(backend.items.list()).rejects.toBeInstanceOf(Error)
    await expect(backend.items.remove('item')).rejects.toBeInstanceOf(Error)
    expect(readFileSync(join(root, path), 'utf8')).toBe(contents)
  })

  it('accepts an explicitly empty versioned context', async () => {
    await vault.writeNote(
      '.campus/academic/context.json',
      '{"schemaVersion":1,"context":null}',
      null,
    )
    expect(await backend.academic.context()).toBeNull()
  })
})
