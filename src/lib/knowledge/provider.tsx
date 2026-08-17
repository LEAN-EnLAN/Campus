import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useFiles, type FilesAccess } from '@/lib/files/context'

import { VaultIndex } from './vault-index'

/**
 * The knowledge index, kept warm for the whole workspace.
 *
 * The index is DERIVED and rebuildable — canonical truth stays in the files
 * (vault-format.md). It is built here by walking the vault once through the
 * files capability, then kept incremental: the shell reports every save,
 * create, rename and trash, and the index never re-scans what it already knows.
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

async function scanVault(files: FilesAccess, index: VaultIndex): Promise<void> {
  // Breadth-first walk. Only .md bodies are read: attachments belong to the
  // explorer, not the link graph.
  const queue: string[] = ['']
  while (queue.length > 0) {
    const dir = queue.shift()!
    let entries
    try {
      entries = await files.listDir(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const path = dir === '' ? entry.name : `${dir}/${entry.name}`
      if (entry.kind === 'dir') queue.push(path)
      else if (entry.name.endsWith('.md')) {
        try {
          const note = await files.readNote(path)
          index.upsert(path, note.contents)
        } catch {
          // A file that vanished mid-scan is the watcher's problem, not the scan's.
        }
      }
    }
  }
}

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const files = useFiles()
  const indexRef = useRef(new VaultIndex())
  const [version, setVersion] = useState(0)
  const [building, setBuilding] = useState(false)
  const [recents, setRecents] = useState<string[]>([])

  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const rebuild = useCallback(async () => {
    if (!files) return
    setBuilding(true)
    const fresh = new VaultIndex()
    await scanVault(files, fresh)
    indexRef.current = fresh
    setBuilding(false)
    bump()
  }, [files, bump])

  useEffect(() => {
    void rebuild()
  }, [rebuild])

  const value = useMemo<KnowledgeValue>(
    () => ({
      index: indexRef.current,
      version,
      building,
      recents,
      noteOpened: (path) =>
        setRecents((r) => [path, ...r.filter((p) => p !== path)].slice(0, 30)),
      noteSaved: (path, contents) => {
        indexRef.current.upsert(path, contents)
        bump()
      },
      noteCreated: (path, contents) => {
        indexRef.current.upsert(path, contents)
        bump()
      },
      noteRenamed: (from, to) => {
        indexRef.current.rename(from, to)
        setRecents((r) => r.map((p) => (p === from ? to : p)))
        bump()
      },
      noteTrashed: (path) => {
        indexRef.current.remove(path)
        setRecents((r) => r.filter((p) => p !== path))
        bump()
      },
      rebuild,
    }),
    [version, building, recents, bump, rebuild],
  )

  return <KnowledgeContext value={value}>{children}</KnowledgeContext>
}

export function useKnowledge(): KnowledgeValue {
  const value = use(KnowledgeContext)
  if (!value) throw new Error('useKnowledge debe usarse dentro de <KnowledgeProvider>')
  return value
}
