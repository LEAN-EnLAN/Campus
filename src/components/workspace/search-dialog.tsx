import { useEffect, useRef, useState } from 'react'

import { useKnowledge } from '@/lib/knowledge/provider'

/**
 * Ctrl/Cmd+Shift+F — full-text search over the vault. Content, tags, titles
 * and filenames, ranked by where the match lives. The quick switcher answers
 * "take me to the note I mean"; this answers "where did I write that?".
 */
export function SearchDialog({
  open,
  onClose,
  onOpen,
}: {
  open: boolean
  onClose: () => void
  onOpen: (path: string) => void
}) {
  const { index, version, building } = useKnowledge()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  void version

  useEffect(() => {
    if (open) {
      setCursor(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  const results = query.trim() ? index.search(query) : []

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
        aria-label="Buscar en el Vault"
        className="bg-paper-elevated border-rule w-full max-w-xl rounded-lg border shadow-sm"
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
          placeholder="Buscar en todas las notas…"
          aria-label="Buscar texto en el Vault"
          className="text-ink placeholder:text-ink-faint w-full border-none bg-transparent px-4 py-3 text-sm outline-none"
        />
        <div className="border-rule max-h-80 overflow-y-auto border-t py-1">
          {building && <p className="text-ink-muted px-4 py-2 text-xs">Indexando el Vault…</p>}
          {!building && query.trim() && results.length === 0 && (
            <div className="px-4 py-6 text-center">
              <svg
                aria-hidden
                viewBox="0 0 64 48"
                className="text-ink-faint mx-auto mb-2 h-10 w-14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="26" cy="20" r="12" />
                <line x1="35" y1="29" x2="48" y2="42" />
                <line x1="20" y1="20" x2="32" y2="20" strokeDasharray="2 3" />
              </svg>
              <p className="text-ink-muted text-sm">Nada contiene «{query}».</p>
            </div>
          )}
          <ul role="listbox" aria-label="Resultados de búsqueda">
            {results.map((r, i) => (
              <li key={r.path} role="option" aria-selected={i === cursor}>
                <button
                  type="button"
                  onClick={() => pick(r.path)}
                  onMouseEnter={() => setCursor(i)}
                  className={`w-full px-4 py-2 text-left ${
                    i === cursor ? 'bg-paper-sunken' : ''
                  }`}
                >
                  <span className="text-ink block truncate text-sm font-medium">{r.title}</span>
                  <span className="text-ink-muted block truncate text-xs">{r.snippet}</span>
                  <span className="text-ink-faint block truncate text-xs">{r.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
