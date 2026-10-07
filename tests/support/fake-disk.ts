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
      listDir: async () => [],
      mkdir: async () => {},
      rename: async () => {},
      trash: async () => ({ trashedTo: '' }),
    }
  }
}
