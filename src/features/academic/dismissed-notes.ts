import { useCallback, useSyncExternalStore } from 'react'

/**
 * Which "el plan indica que te falta…" notes the student has dismissed.
 *
 * A dismissal is a reading preference, not academic data: it is kept in this
 * browser, never in the vault or the cloud, and never changes a subject's state
 * or the progress count. It is keyed by the contradiction itself, so fixing one
 * gap and leaving another brings the note back.
 */

export const DISMISSED_NOTES_KEY = 'campus.dismissed-order-notes'

const listeners = new Set<() => void>()
let cached: { raw: string | null; keys: ReadonlySet<string> } | null = null

function read(): ReadonlySet<string> {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(DISMISSED_NOTES_KEY)
  } catch {
    return new Set()
  }
  // The same Set instance for the same stored text: `useSyncExternalStore`
  // compares snapshots by identity, and a fresh Set every call would re-render forever.
  if (cached && cached.raw === raw) return cached.keys

  let keys = new Set<string>()
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed))
        keys = new Set(parsed.filter((k): k is string => typeof k === 'string'))
    } catch {
      /* unreadable: treat as empty */
    }
  }
  cached = { raw, keys }
  return keys
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function write(keys: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(DISMISSED_NOTES_KEY, JSON.stringify([...keys]))
  } catch {
    /* storage full or blocked: the note simply comes back next time */
  }
  for (const listener of listeners) listener()
}

export function useDismissedNotes(): {
  isDismissed: (key: string) => boolean
  dismiss: (key: string) => void
} {
  const keys = useSyncExternalStore(subscribe, read, () => new Set<string>())
  const isDismissed = useCallback((key: string) => keys.has(key), [keys])
  const dismiss = useCallback((key: string) => write(new Set([...read(), key])), [])
  return { isDismissed, dismiss }
}
