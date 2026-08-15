import { constants } from 'node:fs'
import {
  access,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { DirEntry, EntryKind, FileStat, FileSystemPort } from './fs-port'

/**
 * The Node adapter. Mechanical plumbing over `node:fs` — every security decision
 * lives in `path-resolver.ts` and `vault-repository.ts`, never here.
 *
 * This runs server-side (dev-server route now, Tauri in Milestone D), never in
 * the browser bundle.
 */

function kindOf(s: {
  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean
}): EntryKind {
  if (s.isSymbolicLink()) return 'symlink'
  if (s.isDirectory()) return 'dir'
  if (s.isFile()) return 'file'
  return 'other'
}

export const nodeFileSystem: FileSystemPort = {
  realpath: (absolute) => realpath(absolute),

  async lstat(absolute): Promise<FileStat | null> {
    try {
      const s = await lstat(absolute)
      return { kind: kindOf(s), size: s.size, mtimeMs: s.mtimeMs }
    } catch (error) {
      // Only absence is an expected answer. A permission error or an I/O fault
      // must keep propagating — reporting them as "not there" would let the
      // repository happily create a file over something it could not read.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  },

  readlink: (absolute) => readlink(absolute),
  readFile: (absolute) => readFile(absolute, 'utf8'),

  async writeFileAtomic(absolute, contents): Promise<void> {
    const dir = dirname(absolute)
    // Same directory, so the rename below is a true rename and not a
    // cross-filesystem copy. The pid/time suffix only avoids collisions between
    // concurrent writers; it is not a security property.
    const tmp = join(
      dir,
      `.campus-tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    )

    const handle = await open(tmp, 'wx')
    try {
      await handle.writeFile(contents, 'utf8')
      // fsync BEFORE the rename. Without it the rename can land while the data
      // is still in the page cache, and a crash leaves a correctly-named file
      // with no contents — exactly the truncation VAULT-002 forbids.
      await handle.sync()
    } finally {
      await handle.close()
    }

    try {
      await rename(tmp, absolute)
    } catch (error) {
      await rm(tmp, { force: true })
      throw error
    }
  },

  async mkdirp(absolute): Promise<void> {
    await mkdir(absolute, { recursive: true })
  },

  async readdir(absolute): Promise<DirEntry[]> {
    const entries = await readdir(absolute, { withFileTypes: true })
    return entries.map((e) => ({ name: e.name, kind: kindOf(e) }))
  },

  rename: (from, to) => rename(from, to),

  async remove(absolute): Promise<void> {
    await rm(absolute, { recursive: true, force: true })
  },

  join: (...parts) => join(...parts),
  dirname: (absolute) => dirname(absolute),
}

/** Does this path exist at all, following symlinks? Used only by callers that genuinely want that. */
export async function exists(absolute: string): Promise<boolean> {
  try {
    await access(absolute, constants.F_OK)
    return true
  } catch {
    return false
  }
}
