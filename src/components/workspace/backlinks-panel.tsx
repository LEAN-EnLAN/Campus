import { useState } from 'react'

import { useKnowledge } from '@/lib/knowledge/provider'

/**
 * Linked mentions for the active note — collapsed by default at the bottom of
 * the pane, because backlinks answer "who talks about this?" and that question
 * comes AFTER writing, not during it.
 *
 * Each mention shows its source and the line where the link lives; clicking
 * navigates. Zero mentions is a real state with its own sentence, not an empty
 * box.
 */
export function BacklinksPanel({
  path,
  onOpen,
}: {
  path: string
  onOpen: (path: string) => void
}) {
  const { index, version } = useKnowledge()
  const [open, setOpen] = useState(false)
  void version

  const backlinks = index.backlinks(path)

  return (
    <div className="border-rule border-t">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="text-ink-muted hover:text-ink flex w-full items-center gap-2 px-4 py-1.5 text-xs md:pl-[var(--rule-text-inset)]"
      >
        <span aria-hidden>{open ? '▾' : '▸'}</span>
        <span>
          Menciones <span className="text-ink-faint">({backlinks.length})</span>
        </span>
      </button>
      {open && (
        <ul className="max-h-40 overflow-y-auto px-4 pb-2 md:pl-[var(--rule-text-inset)]">
          {backlinks.length === 0 && (
            <li className="text-ink-faint py-1 text-xs">
              Ninguna otra nota enlaza a esta todavía.
            </li>
          )}
          {backlinks.map((b) => (
            <li key={`${b.sourcePath}`}>
              <button
                type="button"
                onClick={() => onOpen(b.sourcePath)}
                className="hover:bg-paper-sunken w-full rounded-md px-2 py-1 text-left"
              >
                <span className="text-ink block truncate text-xs font-medium">
                  {b.sourceTitle}
                </span>
                <span className="text-ink-muted block truncate text-xs">{b.snippet}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
