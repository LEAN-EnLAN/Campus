import type { FilesAccess, LoadedNote } from '@/lib/files/context'
import { VaultConflictError, VaultError } from '@/lib/vault/errors'

/**
 * An in-memory vault with the same conflict rules as the real one (mtime check
 * before every write, a typed conflict on mismatch) and a controllable write
 * latency, so races can be reproduced on demand instead of hoped for.
 */
export class FakeDisk {
  files = new Map<string, { contents: string; mtimeMs: number }>()
  latency = 0
  writes: string[] = []
  /** Every readNote path, in order — what a re-scan costs. */
  reads: string[] = []
  /** Every listDir path, in order. */
  listings: string[] = []
  failNextWith: Error | null = null
  private clock = 1000

  put(path: string, contents: string) {
    this.files.set(path, { contents, mtimeMs: ++this.clock })
  }

  /** Someone else (git, the student's other editor) changes the file. */
  externalWrite(path: string, contents: string) {
    this.put(path, contents)
  }

  externalDelete(path: string) {
    this.files.delete(path)
  }

  contents(path: string) {
    return this.files.get(path)?.contents
  }

  access(): FilesAccess {
    const wait = () =>
      this.latency === 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => setTimeout(resolve, this.latency))
    return {
      readNote: async (path) => {
        this.reads.push(path)
        const file = this.files.get(path)
        if (!file) throw new VaultError('not_found', 'not found')
        return { contents: file.contents, mtimeMs: file.mtimeMs } satisfies LoadedNote
      },
      stat: async (path) => {
        const file = this.files.get(path)
        return file ? { kind: 'file', mtimeMs: file.mtimeMs, size: file.contents.length } : null
      },
      writeNote: async (path, contents, expected) => {
        await wait()
        if (this.failNextWith) {
          const error = this.failNextWith
          this.failNextWith = null
          throw error
        }
        const file = this.files.get(path)
        if (expected === null) {
          if (file) throw new VaultConflictError(path, 'exists', 'already_exists')
        } else if (!file) {
          throw new VaultConflictError(path, 'gone', 'conflict_missing')
        } else if (file.mtimeMs !== expected) {
          throw new VaultConflictError(path, 'changed', 'conflict_changed')
        }
        this.writes.push(contents)
        this.put(path, contents)
      },
      listDir: async (dir) => {
        this.listings.push(dir)
        const prefix = dir === '' ? '' : dir + '/'
        const seen = new Map<string, 'file' | 'dir'>()
        for (const path of this.files.keys()) {
          if (!path.startsWith(prefix)) continue
          const rest = path.slice(prefix.length)
          const slash = rest.indexOf('/')
          if (slash === -1) seen.set(rest, 'file')
          else seen.set(rest.slice(0, slash), 'dir')
        }
        if (dir !== '' && seen.size === 0) throw new VaultError('not_found', 'not found')
        return [...seen].map(([name, kind]) => {
          const file = this.files.get(prefix + name)
          return { name, kind, mtimeMs: file?.mtimeMs ?? 0, size: file?.contents.length ?? 0 }
        })
      },
      mkdir: async () => {},
      rename: async (from, to) => {
        const moving = [...this.files.keys()].filter(
          (p) => p === from || p.startsWith(from + '/'),
        )
        if (moving.length === 0) throw new VaultError('not_found', 'not found')
        if (this.files.has(to) || [...this.files.keys()].some((p) => p.startsWith(to + '/'))) {
          throw new VaultConflictError(to, 'exists', 'destination_exists')
        }
        for (const path of moving) {
          const file = this.files.get(path)!
          this.files.delete(path)
          this.files.set(to + path.slice(from.length), file)
        }
      },
      trash: async (path) => {
        const going = [...this.files.keys()].filter(
          (p) => p === path || p.startsWith(path + '/'),
        )
        if (going.length === 0) throw new VaultError('not_found', 'not found')
        for (const p of going) this.files.delete(p)
        return { trashedTo: `.campus/trash/${path}` }
      },
    }
  }
}
