import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setImmediate } from 'node:timers/promises'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LocalBackend } from '@/lib/backends/local/local-backend'
import { symlinkSync } from '../../../tests/support/real-links'

import { VaultConflictError } from './errors'
import type { FileSystemPort } from './fs-port'
import { nodeFileSystem } from './node-fs'
import { VaultRepository } from './vault-repository'

function signal() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

// Real disk, but synchronous pre-write syscalls behind the async port. A single
// event-loop turn drains ALL pre-write work up to an explicit gate, without a
// wall-clock delay or requiring a second writer to enter the critical section.
const scheduledDisk: FileSystemPort = {
  ...nodeFileSystem,
  realpath: async (path) => realpathSync(path),
  readlink: async (path) => readlinkSync(path),
  readFile: async (path) => readFileSync(path, 'utf8'),
  mkdirp: async (path) => {
    mkdirSync(path, { recursive: true })
  },
  lstat: async (path) => {
    try {
      const stat = lstatSync(path)
      return {
        kind: stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'dir' : 'file',
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  },
}

let root: string
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'campus-f09-')))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function holdFirstWrite(target: string) {
  const entered = signal()
  const release = signal()
  const written = signal()
  let first = true
  const fs: FileSystemPort = {
    ...scheduledDisk,
    async writeFileAtomic(path, contents) {
      if (path.toLowerCase() !== target.toLowerCase()) {
        return nodeFileSystem.writeFileAtomic(path, contents)
      }
      if (first) {
        first = false
        entered.resolve()
        await release.promise
        try {
          await nodeFileSystem.writeFileAtomic(path, contents)
        } finally {
          written.resolve()
        }
      } else {
        // On the unsafe implementation B has already passed its mtime check.
        // Force A then B replacement so the lost update is deterministic.
        await written.promise
        await nodeFileSystem.writeFileAtomic(path, contents)
      }
    },
  }
  return { fs, entered: entered.promise, release: release.resolve }
}

const outcome = <T>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  )

describe('F09: distinct repositories writing the same physical vault', () => {
  it.each([false, true])(
    'never acknowledges a lost item (existing items file: %s)',
    async (existing) => {
      const target = join(root, '.campus', 'academic', 'items.json')
      if (existing) {
        mkdirSync(join(root, '.campus', 'academic'), { recursive: true })
        writeFileSync(target, JSON.stringify({ schemaVersion: 1, items: [] }))
        // A known older baseline, independent of the host filesystem clock tick.
        utimesSync(target, 1_000, 1_000)
      }
      const gate = holdFirstWrite(target)
      const catalog = { institutions: [], curricula: new Map() }
      const a = new LocalBackend(new VaultRepository(gate.fs, root), catalog)
      const b = new LocalBackend(new VaultRepository(gate.fs, root), catalog)
      const input = { kind: 'task' as const, curriculumSubjectId: null, dueAt: null }
      const first = outcome(a.items.create({ ...input, title: 'Writer A' }))
      await gate.entered
      const second = outcome(b.items.create({ ...input, title: 'Writer B' }))
      await setImmediate()
      gate.release()
      const results = await Promise.all([first, second])
      const disk = new LocalBackend(new VaultRepository(nodeFileSystem, root), catalog)
      const titles = (await disk.items.list()).map((item) => item.title)
      for (const result of results) {
        if (result.ok)
          expect(titles, 'an acknowledged item was lost').toContain(result.value.title)
        else expect(result.error).toBeInstanceOf(VaultConflictError)
      }
      expect(results[0].ok).toBe(true)
      expect(results[1]).toMatchObject({
        ok: false,
        error: { code: existing ? 'conflict_changed' : 'already_exists' },
      })
      expect(titles).toEqual(['Writer A'])
    },
  )

  it('lets a different file finish while the first file is held', async () => {
    const gate = holdFirstWrite(join(root, 'a.md'))
    const a = new VaultRepository(gate.fs, root)
    const b = new VaultRepository({ ...gate.fs }, root)
    const pending = a.writeNote('a.md', 'A', null)
    await gate.entered
    try {
      await b.writeNote('b.md', 'B', null)
      expect(readFileSync(join(root, 'b.md'), 'utf8')).toBe('B')
    } finally {
      gate.release()
      await pending
    }
  })

  it('coordinates in-vault directory aliases across distinct filesystem adapters', async () => {
    mkdirSync(join(root, 'notes'))
    symlinkSync(join(root, 'notes'), join(root, 'alias'))
    const gate = holdFirstWrite(join(root, 'notes', 'a.md'))
    const a = new VaultRepository(gate.fs, root)
    const b = new VaultRepository({ ...gate.fs }, root)
    const first = a.writeNote('notes/a.md', 'A', null)
    await gate.entered
    const second = outcome(b.writeNote('./alias\\a.md', 'B', null))
    await setImmediate()
    gate.release()
    await first
    expect(await second).toMatchObject({ ok: false, error: { code: 'already_exists' } })
    expect(readFileSync(join(root, 'notes', 'a.md'), 'utf8')).toBe('A')
  })

  it.skipIf(process.platform !== 'win32')(
    'coordinates Windows case aliases for a missing file',
    async () => {
      const gate = holdFirstWrite(join(root, 'Note.md'))
      const a = new VaultRepository(gate.fs, root)
      const b = new VaultRepository({ ...gate.fs }, root)
      const first = a.writeNote('Note.md', 'A', null)
      await gate.entered
      const second = outcome(b.writeNote('note.md', 'B', null))
      await setImmediate()
      gate.release()
      await first
      expect(await second).toMatchObject({ ok: false, error: { code: 'already_exists' } })
      expect(readFileSync(join(root, 'Note.md'), 'utf8')).toBe('A')
    },
  )

  it('keeps a queued successor protected when a failed predecessor releases', async () => {
    const entered = signal()
    const release = signal()
    const nextEntered = signal()
    const nextRelease = signal()
    let calls = 0
    const fs: FileSystemPort = {
      ...scheduledDisk,
      async writeFileAtomic(path, contents) {
        calls += 1
        if (calls === 1) {
          entered.resolve()
          await release.promise
          throw new Error('first write failed')
        }
        if (calls === 2) {
          nextEntered.resolve()
          await nextRelease.promise
        }
        await nodeFileSystem.writeFileAtomic(path, contents)
      },
    }
    const fresh = () => new VaultRepository({ ...fs }, root)
    const first = outcome(fresh().writeNote('a.md', 'A', null))
    await entered.promise
    const second = outcome(fresh().writeNote('a.md', 'B', null))
    await setImmediate()
    release.resolve()
    expect(await first).toMatchObject({ ok: false })
    await nextEntered.promise
    const third = outcome(fresh().writeNote('a.md', 'C', null))
    await setImmediate()
    nextRelease.resolve()
    expect(await second).toMatchObject({ ok: true })
    expect(await third).toMatchObject({ ok: false, error: { code: 'already_exists' } })
    expect(readFileSync(join(root, 'a.md'), 'utf8')).toBe('B')
  })

  it.each(['mkdirp', 'writeFileAtomic'] as const)(
    'releases queued and later writers after %s fails',
    async (method) => {
      const entered = signal()
      const release = signal()
      let fail = true
      const fs: FileSystemPort = {
        ...scheduledDisk,
        [method]: async (...args: [string, string]) => {
          if (fail) {
            fail = false
            entered.resolve()
            await release.promise
            throw new Error('injected IO failure')
          }
          if (method === 'mkdirp') await scheduledDisk.mkdirp(args[0])
          else await scheduledDisk.writeFileAtomic(...args)
        },
      }
      const a = new VaultRepository(fs, root)
      const b = new VaultRepository({ ...fs }, root)
      const first = outcome(a.writeNote('a.md', 'A', null))
      await entered.promise
      const second = outcome(b.writeNote('a.md', 'B', null))
      await setImmediate()
      release.resolve()
      expect(await first).toMatchObject({
        ok: false,
        error: { message: 'injected IO failure' },
      })
      expect(await second).toMatchObject({ ok: true })
      const loaded = await b.readNote('a.md')
      await a.writeNote('a.md', 'C', loaded.mtimeMs)
      expect(readFileSync(join(root, 'a.md'), 'utf8')).toBe('C')
    },
  )

  it.each([false, true])(
    'revalidates a queued symlink path (outside vault: %s)',
    async (outside) => {
      mkdirSync(join(root, 'notes'))
      mkdirSync(join(root, 'other'))
      symlinkSync(join(root, 'notes'), join(root, 'alias'))
      const gate = holdFirstWrite(join(root, 'notes', 'a.md'))
      const a = new VaultRepository(gate.fs, root)
      const b = new VaultRepository(gate.fs, root)
      const first = a.writeNote('notes/a.md', 'A', null)
      await gate.entered
      const second = outcome(b.writeNote('alias/a.md', 'B', null))
      await setImmediate()
      rmSync(join(root, 'alias'), { recursive: true })
      symlinkSync(outside ? tmpdir() : join(root, 'other'), join(root, 'alias'))
      gate.release()
      await first
      expect(await second).toMatchObject({
        ok: false,
        error: { code: outside ? 'outside_vault' : 'conflict_changed' },
      })
      expect(readFileSync(join(root, 'notes', 'a.md'), 'utf8')).toBe('A')
      expect(await b.stat('other/a.md')).toBeNull()
    },
  )
})
