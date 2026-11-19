import { VaultConflictError, VaultError } from './errors'
import type { VaultAccess, VaultEntry } from './vault-access'

/**
 * A vault that lives only in this tab's memory.
 *
 * Used by the demo: the same `LocalBackend` a real folder gets, over files that
 * vanish when the tab closes. It keeps the real vault's conflict rules (an
 * mtime check before every write, a typed conflict on mismatch), so code that
 * works against it works against a folder too — the demo is not a second app.
 */
export function memoryVaultAccess(): VaultAccess & { files(): ReadonlyMap<string, string> } {
  const files = new Map<string, { contents: string; mtimeMs: number }>()
  const dirs = new Set<string>([''])
  let clock = Date.now()
  const tick = () => ++clock

  const clean = (path: string) => path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const parentsOf = (path: string) => {
    const parts = path.split('/')
    return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'))
  }
  const addParents = (path: string) => {
    for (const dir of parentsOf(path)) dirs.add(dir)
  }
  const under = (path: string, root: string) => path === root || path.startsWith(root + '/')

  return {
    files: () => new Map([...files].map(([path, file]) => [path, file.contents])),

    readNote: async (relative) => {
      const file = files.get(clean(relative))
      if (!file) throw new VaultError('not_found', 'not found')
      return { contents: file.contents, mtimeMs: file.mtimeMs }
    },

    writeNote: async (relative, contents, expected) => {
      const path = clean(relative)
      const file = files.get(path)
      if (expected === null) {
        if (file) throw new VaultConflictError(path, 'exists', 'already_exists')
      } else if (!file) {
        throw new VaultConflictError(path, 'gone', 'conflict_missing')
      } else if (file.mtimeMs !== expected) {
        throw new VaultConflictError(path, 'changed', 'conflict_changed')
      }
      addParents(path)
      files.set(path, { contents, mtimeMs: tick() })
    },

    listDir: async (relative) => {
      const dir = clean(relative)
      if (!dirs.has(dir)) throw new VaultError('not_found', 'not found')
      const prefix = dir === '' ? '' : dir + '/'
      const entries = new Map<string, VaultEntry>()
      for (const path of dirs) {
        if (path === dir || !path.startsWith(prefix)) continue
        const name = path.slice(prefix.length)
        if (!name.includes('/')) entries.set(name, { name, kind: 'dir', mtimeMs: 0, size: 0 })
      }
      for (const [path, file] of files) {
        if (!path.startsWith(prefix)) continue
        const name = path.slice(prefix.length)
        if (name.includes('/')) continue
        entries.set(name, {
          name,
          kind: 'file',
          mtimeMs: file.mtimeMs,
          size: file.contents.length,
        })
      }
      return [...entries.values()]
    },

    mkdir: async (relative) => {
      const dir = clean(relative)
      addParents(dir + '/x')
    },

    rename: async (from, to) => {
      const source = clean(from)
      const target = clean(to)
      const movingFiles = [...files.keys()].filter((p) => under(p, source))
      const movingDirs = [...dirs].filter((p) => p !== '' && under(p, source))
      if (movingFiles.length === 0 && movingDirs.length === 0) {
        throw new VaultError('not_found', 'not found')
      }
      if (files.has(target) || dirs.has(target)) {
        throw new VaultConflictError(target, 'exists', 'destination_exists')
      }
      for (const path of movingFiles) {
        const file = files.get(path)
        if (!file) continue
        files.delete(path)
        files.set(target + path.slice(source.length), { ...file, mtimeMs: tick() })
      }
      for (const path of movingDirs) {
        dirs.delete(path)
        dirs.add(target + path.slice(source.length))
      }
      addParents(target)
    },

    trash: async (relative) => {
      const path = clean(relative)
      const going = [...files.keys()].filter((p) => under(p, path))
      const goingDirs = [...dirs].filter((p) => p !== '' && under(p, path))
      if (going.length === 0 && goingDirs.length === 0) {
        throw new VaultError('not_found', 'not found')
      }
      for (const p of going) files.delete(p)
      for (const p of goingDirs) dirs.delete(p)
      return { trashedTo: `.campus/trash/${path}` }
    },

    stat: async (relative) => {
      const path = clean(relative)
      const file = files.get(path)
      if (file) return { kind: 'file', mtimeMs: file.mtimeMs, size: file.contents.length }
      if (dirs.has(path)) return { kind: 'dir', mtimeMs: 0, size: 0 }
      return null
    },
  }
}
