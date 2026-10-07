import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { useFiles } from '@/lib/files/context'
import { isWithin, movedPath } from '@/lib/workspace/model'

import { ensureSessionIndex, sessionFor, syncSessionIndex } from './session-index'
import { VaultIndex } from './vault-index'

/**
 * The knowledge index, kept warm for the whole workspace.
 *
 * The index is DERIVED and rebuildable — canonical truth stays in the files
 * (vault-format.md). It lives in `session-index.ts`, ONE per session and vault,
 * shared with global search: it is built the first time anyone needs it, then
 * kept incremental — the shell reports every save, create, rename and trash, and
 * re-entering the workspace only re-reads notes whose mtime moved.
 *
 * `version` is a plain counter bumped on every change. Consumers depend on it
 * instead of the (deliberately mutable) index object, so React re-renders
 * exactly when knowledge changed and never because a reference was recreated.
 */

interface KnowledgeValue {
  index: VaultIndex
  version: number
  building: boolean
  /** Paths opened recently, newest first — the quick switcher's first page. */
  recents: string[]
  noteOpened(path: string): void
  noteSaved(path: string, contents: string): void
  noteCreated(path: string, contents: string): void
  noteRenamed(from: string, to: string): void
  noteTrashed(path: string): void
  rebuild(): Promise<void>
}

const KnowledgeContext = createContext<KnowledgeValue | null>(null)

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const files = useFiles()
  // The session's own index when there is a vault; a throwaway otherwise (the
  // provider is only mounted inside a vault, but hooks cannot be conditional).
  const [fallback] = useState(() => new VaultIndex())
  const session = useMemo(() => (files ? sessionFor(files) : null), [files])
  const index = session?.index ?? fallback
  const [version, setVersion] = useState(0)
  const [building, setBuilding] = useState(() => !(session?.built ?? true))
  const [recents, setRecents] = useState<string[]>([])

  const bump = useCallback(() => setVersion((v) => v + 1), [])

  /** Bring the index up to date: only changed notes are re-read. */
  const rebuild = useCallback(async () => {
    if (!files) return
    setBuilding(true)
    await syncSessionIndex(files)
    setBuilding(false)
    bump()
  }, [files, bump])

  useEffect(() => {
    if (!files || !session) return
    let cancelled = false
    void (async () => {
      // The first visit pays for the scan; later ones list folders and read
      // only what changed.
      if (session.built) await syncSessionIndex(files)
      else await ensureSessionIndex(files)
      if (cancelled) return
      setBuilding(false)
      bump()
    })()
    return () => {
      cancelled = true
    }
  }, [files, session, bump])

  const value = useMemo<KnowledgeValue>(
    () => ({
      index,
      version,
      building,
      recents,
      noteOpened: (path) =>
        setRecents((r) => [path, ...r.filter((p) => p !== path)].slice(0, 30)),
      noteSaved: (path, contents) => {
        index.upsert(path, contents)
        bump()
      },
      noteCreated: (path, contents) => {
        index.upsert(path, contents)
        bump()
      },
      noteRenamed: (from, to) => {
        index.rename(from, to)
        session?.renamed(from, to)
        setRecents((r) => r.map((p) => movedPath(p, from, to)))
        bump()
      },
      noteTrashed: (path) => {
        index.remove(path)
        session?.removed(path)
        setRecents((r) => r.filter((p) => !isWithin(p, path)))
        bump()
      },
      rebuild,
    }),
    [index, session, version, building, recents, bump, rebuild],
  )

  return <KnowledgeContext value={value}>{children}</KnowledgeContext>
}

export function useKnowledge(): KnowledgeValue {
  const value = use(KnowledgeContext)
  if (!value) throw new Error('useKnowledge debe usarse dentro de <KnowledgeProvider>')
  return value
}
