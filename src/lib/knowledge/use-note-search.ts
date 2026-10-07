import { useCallback, useEffect, useState } from 'react'

import { useFiles } from '@/lib/files/context'

import type { SearchResult } from './vault-index'
import { ensureSessionIndex, sessionFor } from './session-index'

/**
 * Notes for global search, from the SAME index the workspace uses.
 *
 * No second scanner: the first time search opens in a session the shared index
 * is built (every later consumer — this one, the workspace — reuses it), and
 * typing only ever queries memory. Without a vault (cloud mode) there is
 * nothing to search and `available` is false, so callers can say nothing about
 * notes at all.
 */
export function useNoteSearch(active: boolean): {
  available: boolean
  search: (query: string) => SearchResult[]
} {
  const files = useFiles()
  const [ready, setReady] = useState(() => (files ? sessionFor(files).built : false))

  useEffect(() => {
    if (!active || !files) return
    let cancelled = false
    void ensureSessionIndex(files).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [active, files])

  // `ready` is a dependency on purpose: it gives `search` a new identity when
  // the scan finishes, so a query typed while it ran is answered again.
  const search = useCallback(
    (query: string) => (files && ready ? sessionFor(files).index.search(query) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, ready],
  )

  return { available: files !== null, search }
}
