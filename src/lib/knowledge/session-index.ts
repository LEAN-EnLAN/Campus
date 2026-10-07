import type { FilesAccess } from '@/lib/files/context'

import { VaultIndex } from './vault-index'

/**
 * ONE note index per session, per vault — shared by the workspace and by global
 * search, and never scanned twice.
 *
 * The index is derived and rebuildable (canonical truth stays in the files), but
 * rebuilding it means a request per note. The workspace used to do that, serially,
 * on every visit to /vault, and global search had no index at all. Now:
 *
 * - The index is keyed by the files capability, so every consumer in a session
 *   gets the same object, and a different vault never sees it.
 * - A sync lists the folders (one request each) and reads only the notes that
 *   are new or whose mtime moved. Re-entering /vault with nothing changed
 *   issues no per-note request at all.
 * - Reads run with bounded concurrency, not one at a time.
 */

const sessions = new WeakMap<FilesAccess, SessionIndex>()

const LIST_CONCURRENCY = 8
const READ_CONCURRENCY = 8

export class SessionIndex {
  readonly index = new VaultIndex()
  /** The mtime each indexed note had when we last read it. */
  readonly mtimes = new Map<string, number>()
  built = false
  running: Promise<void> | null = null

  /** The vault moved `from` to `to` (a note or a folder): carry the mtimes along. */
  renamed(from: string, to: string): void {
    for (const [path, mtime] of [...this.mtimes]) {
      if (path === from || path.startsWith(from + '/')) {
        this.mtimes.delete(path)
        this.mtimes.set(to + path.slice(from.length), mtime)
      }
    }
  }

  /** The vault trashed `path` (a note or a folder). */
  removed(path: string): void {
    for (const known of [...this.mtimes.keys()]) {
      if (known === path || known.startsWith(path + '/')) this.mtimes.delete(known)
    }
  }
}

export function sessionFor(files: FilesAccess): SessionIndex {
  let session = sessions.get(files)
  if (!session) {
    session = new SessionIndex()
    sessions.set(files, session)
  }
  return session
}

/** Build the index the first time it is needed; free afterwards. */
export function ensureSessionIndex(files: FilesAccess): Promise<void> {
  const session = sessionFor(files)
  if (session.built) return Promise.resolve()
  return syncSessionIndex(files, session)
}

/**
 * Bring the index up to date with the disk. Concurrent callers share one run.
 * `session` is only for tests that hand in a capability wrapper.
 */
export function syncSessionIndex(
  files: FilesAccess,
  session: SessionIndex = sessionFor(files),
): Promise<void> {
  session.running ??= run(files, session).finally(() => {
    session.running = null
  })
  return session.running
}

async function mapLimit<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++]!
      await work(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
}

async function run(files: FilesAccess, session: SessionIndex): Promise<void> {
  const seen = new Set<string>()
  const unlistable: string[] = []
  const stale: string[] = []

  // Breadth-first over folders, a level at a time. Only .md files are indexed:
  // attachments belong to the explorer, not the link graph.
  let level = ['']
  while (level.length > 0) {
    const nextLevel: string[] = []
    await mapLimit(level, LIST_CONCURRENCY, async (dir) => {
      let entries
      try {
        entries = await files.listDir(dir)
      } catch {
        // Keep what we knew about a folder we could not read this time.
        unlistable.push(dir)
        return
      }
      for (const entry of entries) {
        const path = dir === '' ? entry.name : `${dir}/${entry.name}`
        if (entry.kind === 'dir') nextLevel.push(path)
        else if (entry.name.endsWith('.md')) {
          seen.add(path)
          if (session.mtimes.get(path) !== entry.mtimeMs) stale.push(path)
        }
      }
    })
    level = nextLevel
  }

  // Notes that were indexed and are no longer listed have gone (unless their
  // folder simply could not be read).
  for (const note of session.index.notes()) {
    if (seen.has(note.path)) continue
    if (unlistable.some((dir) => dir === '' || note.path.startsWith(dir + '/'))) continue
    session.index.remove(note.path)
    session.mtimes.delete(note.path)
  }

  await mapLimit(stale, READ_CONCURRENCY, async (path) => {
    try {
      const note = await files.readNote(path)
      session.index.upsert(path, note.contents)
      session.mtimes.set(path, note.mtimeMs)
    } catch {
      // A file that vanished mid-scan is the next sync's problem, not this one's.
    }
  })

  session.built = true
}
