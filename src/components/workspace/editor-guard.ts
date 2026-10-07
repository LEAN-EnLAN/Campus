import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { EditorHandle } from './note-editor'

/**
 * The gate between "leave" and "the text the student just typed".
 *
 * Autosave runs 800 ms after the last keystroke, so at any moment a note may
 * hold text the disk does not. Closing a tab, switching notes, leaving /vault
 * or closing the browser used to discard it without a word. Every one of those
 * now goes through here:
 *
 *   settle()  — flush the affected editors, then, ONLY if some text still could
 *               not be saved (a conflict, a failed write), ask before throwing
 *               it away.
 *   unload    — the browser cannot wait for a network round trip, so it gets a
 *               best-effort flush plus the browser's own "leave site?" prompt
 *               while anything is unsaved.
 */
export interface EditorGuard {
  /** An open editor lends its handle. Returns the unregister. */
  register(handle: EditorHandle): () => void
  /**
   * Flush the editors whose path matches (all when omitted). Resolves true when
   * it is safe to proceed: nothing unsaved, or the student agreed to discard.
   */
  settle(match?: (path: string) => boolean): Promise<boolean>
}

export function useEditorGuard(): EditorGuard {
  const editors = useRef(new Set<EditorHandle>())

  const register = useCallback((handle: EditorHandle) => {
    editors.current.add(handle)
    return () => {
      editors.current.delete(handle)
    }
  }, [])

  const settle = useCallback(async (match?: (path: string) => boolean) => {
    const affected = [...editors.current].filter((h) => !match || match(h.path))
    await Promise.all(affected.map((h) => h.flush()))
    const stuck = affected.filter((h) => h.unsaved())
    if (stuck.length === 0) return true
    return window.confirm(
      stuck.length === 1
        ? 'Esta nota tiene cambios que no se pudieron guardar. ¿Salir y perderlos?'
        : `Hay ${stuck.length} notas con cambios que no se pudieron guardar. ¿Salir y perderlas?`,
    )
  }, [])

  useEffect(() => {
    const flushUnsaved = () => {
      const pending = [...editors.current].filter((h) => h.unsaved())
      for (const h of pending) void h.flush()
      return pending.length > 0
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // The write may not finish before the page goes, so the prompt stays
      // while anything is unsaved — including text only seconds old.
      if (flushUnsaved()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    const onPageHide = () => void flushUnsaved()
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])

  return useMemo(() => ({ register, settle }), [register, settle])
}
