import { useEffect, useRef, useState } from 'react'

import { useKnowledge } from '@/lib/knowledge/provider'

/**
 * Ctrl/Cmd+P — the quick switcher. Titles, not content: "take me to the note I
 * mean" in three keystrokes. Full-text search is a different question and
 * lives in the search dialog.
 *
 * Empty query shows recents first, because the note a student wants is almost
 * always one they touched today.
 */
export function QuickSwitcher({
  open,
  onClose,
  onOpen,
}: {
  open: boolean
  onClose: () => void
  onOpen: (path: string) => void
}) {
  const { index, version, recents } = useKnowledge()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      // Focus after the dialog paints; an unfocused palette is a broken palette.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  // `version` keys the memoization implicitly: results recompute per render,
  // and renders happen exactly when knowledge changes.
  void version
  const results = index.quickMatch(query, recents)

  const pick = (path: string) => {
    onOpen(path)
    onClose()
  }

  return (
    <div
      className="bg-ink/30 fixed inset-0 z-40 flex items-start justify-center p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Abrir nota"
        className="bg-paper-elevated border-rule w-full max-w-lg rounded-lg border shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCursor(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(c + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(c - 1, 0))
            } else if (e.key === 'Enter' && results[cursor]) {
              e.preventDefault()
              pick(results[cursor].path)
            }
          }}
          placeholder="Abrir nota…"
          aria-label="Buscar nota por título"
          className="text-ink placeholder:text-ink-faint w-full border-none bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul
          role="listbox"
          aria-label="Resultados"
          className="border-rule max-h-72 overflow-y-auto border-t py-1"
        >
          {results.length === 0 && (
            <li className="text-ink-muted px-4 py-3 text-sm">
              {query ? 'Ninguna nota coincide.' : 'Todavía no hay notas en este Vault.'}
            </li>
          )}
          {results.map((r, i) => (
            <li key={r.path} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onClick={() => pick(r.path)}
                onMouseEnter={() => setCursor(i)}
                className={`flex w-full items-baseline justify-between gap-3 px-4 py-1.5 text-left text-sm ${
                  i === cursor ? 'bg-paper-sunken text-ink' : 'text-ink-muted'
                }`}
              >
                <span className="truncate">{r.title}</span>
                <span className="text-ink-faint shrink-0 text-xs">{r.path}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
