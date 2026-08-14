import { useNavigate } from '@tanstack/react-router'
import { BookMarked, CalendarClock, Link2, Search as SearchIcon } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { search, type SearchResult, type SearchResultKind } from '@/domain/search'
import type { AcademicItem, Resource, SubjectView } from '@/domain/types'
import { cn } from '@/lib/utils'

/**
 * CAP-SEARCH-001 — find a materia, task or resource by partial text.
 *
 * A combobox, wired the way the ARIA pattern says: the input keeps focus and owns
 * `aria-activedescendant`, so arrow keys move the highlight without ever moving
 * focus into the list.
 */

const ICON: Record<SearchResultKind, typeof BookMarked> = {
  subject: BookMarked,
  item: CalendarClock,
  resource: Link2,
}

export function SearchPalette({
  open,
  onOpenChange,
  subjects,
  items,
  resources,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjects: readonly SubjectView[]
  items: readonly AcademicItem[]
  resources: readonly Resource[]
}) {
  const navigate = useNavigate()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const results = useMemo(
    () => (query.trim().length < 2 ? [] : search({ subjects, items, resources }, query)),
    [query, subjects, items, resources],
  )

  useEffect(() => {
    if (!open) return
    restoreFocusTo.current = document.activeElement as HTMLElement | null
    setQuery('')
    setActive(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => {
      window.clearTimeout(timer)
      restoreFocusTo.current?.focus()
    }
  }, [open])

  useEffect(() => setActive(0), [query])

  if (!open) return null

  function go(result: SearchResult | undefined) {
    if (!result) return
    onOpenChange(false)
    if (result.kind === 'subject') {
      void navigate({ to: '/courses/$courseId', params: { courseId: result.id } })
    } else if (result.kind === 'item') {
      void navigate({ to: '/calendar' })
    } else {
      void navigate({ to: '/library' })
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (results.length === 0 ? 0 : (i + 1) % results.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      go(results[active])
    }
  }

  const hasQuery = query.trim().length >= 2

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <button
        type="button"
        aria-label="Cerrar búsqueda"
        onClick={() => onOpenChange(false)}
        className="bg-ink/25 absolute inset-0"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en Campus"
        className="border-rule bg-paper-elevated relative mx-4 w-full max-w-lg overflow-hidden rounded-xl border shadow-lg"
      >
        <div className="border-rule-soft flex items-center gap-3 border-b px-4">
          <SearchIcon aria-hidden="true" className="text-ink-faint size-4 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              results.length > 0 ? `${listId}-option-${active}` : undefined
            }
            aria-label="Buscar materias, entregas y material"
            placeholder="Buscar materias, entregas, material…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="text-ink placeholder:text-ink-faint h-12 flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <ul
          id={listId}
          role="listbox"
          aria-label="Resultados"
          className="max-h-80 overflow-y-auto"
        >
          {results.map((result, index) => {
            const Icon = ICON[result.kind]
            return (
              // The option IS the row. A `role="option"` must not contain a focusable
              // control — that is axe's `nested-interactive`, and it is right: focus
              // stays on the input, which owns the selection via
              // aria-activedescendant. Mouse handlers on a non-focusable element are
              // correct for this pattern; the keyboard path is the input's.
              <li
                key={`${result.kind}-${result.id}`}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(result)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors',
                  index === active ? 'bg-accent-soft' : 'hover:bg-paper-sunken',
                )}
              >
                <Icon aria-hidden="true" className="text-ink-faint size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="text-ink block truncate text-sm">{result.title}</span>
                  {result.subtitle ? (
                    <span className="text-ink-muted block truncate text-xs">
                      {result.subtitle}
                    </span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>

        <p
          aria-live="polite"
          className="border-rule-soft text-ink-muted border-t px-4 py-2.5 text-xs"
        >
          {!hasQuery
            ? 'Escribí al menos dos letras.'
            : results.length === 0
              ? `No encontramos nada con "${query.trim()}".`
              : `${results.length} resultado${results.length === 1 ? '' : 's'}.`}
        </p>
      </div>
    </div>
  )
}
