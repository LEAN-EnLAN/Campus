import { useNavigate } from '@tanstack/react-router'
import { BookMarked, CalendarClock, FileText, Link2, Search as SearchIcon } from 'lucide-react'
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  groupResults,
  matchRange,
  noteResults,
  search,
  type SearchGroup,
  type SearchResult,
  type SearchResultKind,
} from '@/domain/search'
import type { AcademicItem, Resource, SubjectView } from '@/domain/types'
import { useNoteSearch } from '@/lib/knowledge/use-note-search'
import { cn } from '@/lib/utils'

/**
 * CAP-SEARCH-001 — find a materia, task, resource or (with a Vault) note by
 * partial text.
 *
 * A combobox, wired the way the ARIA pattern says: the input keeps focus and owns
 * `aria-activedescendant`, so arrow keys move the highlight without ever moving
 * focus into the list. Results are grouped by type (`role="group"` inside the
 * listbox, each named by its heading); the arrow keys walk straight across
 * groups. The part of each result that matched is marked, accents or not.
 */

const ICON: Record<SearchResultKind, typeof BookMarked> = {
  subject: BookMarked,
  item: CalendarClock,
  resource: Link2,
  note: FileText,
}

export function SearchPalette({
  open,
  onOpenChange,
  subjects,
  items,
  resources,
  prerequisitesKnown,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjects: readonly SubjectView[]
  items: readonly AcademicItem[]
  resources: readonly Resource[]
  /** Whether the plan's correlativas are known; unknown ones never read as "Disponible". */
  prerequisitesKnown: boolean
}) {
  const navigate = useNavigate()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  // Notes come from the shared note index (built once per session, queried in
  // memory); without a Vault there is no such thing and nothing about notes shows.
  const notes = useNoteSearch(open)

  const groups = useMemo(() => {
    if (query.trim().length < 2) return []
    return groupResults([
      ...search({ subjects, items, resources, prerequisitesKnown }, query, 40),
      ...noteResults(notes.search(query)),
    ])
  }, [query, subjects, items, resources, prerequisitesKnown, notes.search])
  // The keyboard order: groups top to bottom, results within each.
  const results = useMemo(() => groups.flatMap((group) => group.results), [groups])

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
    } else if (result.kind === 'note') {
      void navigate({ to: '/vault', search: { note: result.id } })
    } else if (result.kind === 'item') {
      // Land on the day of the entrega, not on "this month".
      void navigate({ to: '/calendar', search: result.date ? { date: result.date } : {} })
    } else if (result.subjectId) {
      void navigate({ to: '/courses/$courseId', params: { courseId: result.subjectId } })
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
    <div className="pt-dialog-top fixed inset-0 z-50 flex items-start justify-center">
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
            aria-label={
              notes.available
                ? 'Buscar materias, entregas, material y notas'
                : 'Buscar materias, entregas y material'
            }
            placeholder={
              notes.available
                ? 'Buscar materias, entregas, material, notas…'
                : 'Buscar materias, entregas, material…'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="text-ink placeholder:text-ink-faint h-12 flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label="Resultados"
          className="max-h-96 overflow-y-auto"
        >
          {groups.map((group) => {
            const headingId = `${listId}-group-${group.kind}`
            return (
              <div key={group.kind} role="group" aria-labelledby={headingId}>
                <div
                  id={headingId}
                  className="text-ink-muted flex items-baseline justify-between px-4 pt-3 pb-1 text-xs font-medium"
                >
                  <span>{group.label}</span>
                  <span className="text-ink-faint tabular-nums">{group.results.length}</span>
                </div>
                {group.results.map((result) => {
                  const index = results.indexOf(result)
                  const Icon = ICON[result.kind]
                  return (
                    // The option IS the row. A `role="option"` must not contain a
                    // focusable control — that is axe's `nested-interactive`, and it
                    // is right: focus stays on the input, which owns the selection
                    // via aria-activedescendant. Mouse handlers on a non-focusable
                    // element are correct for this pattern; the keyboard path is
                    // the input's.
                    <div
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
                        <span className="text-ink block truncate text-sm">
                          <Highlighted text={result.title} query={query} />
                        </span>
                        {result.subtitle ? (
                          <span className="text-ink-muted block truncate text-xs">
                            <Highlighted text={result.subtitle} query={query} />
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <p
          aria-live="polite"
          className="border-rule-soft text-ink-muted border-t px-4 py-2.5 text-xs"
        >
          {!hasQuery
            ? 'Escribí al menos dos letras.'
            : results.length === 0
              ? `No encontramos nada con "${query.trim()}".`
              : summary(groups)}
        </p>
      </div>
    </div>
  )
}

/** "5 resultados: Materias 2, Material 3." — the counts, said once for screen readers too. */
function summary(groups: readonly SearchGroup[]): string {
  const total = groups.reduce((n, group) => n + group.results.length, 0)
  const parts = groups.map((group) => `${group.label} ${group.results.length}`)
  return `${total} resultado${total === 1 ? '' : 's'}: ${parts.join(', ')}.`
}

/** The text with the part that matched the query marked — accents or not. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const range = matchRange(text, query)
  if (!range) return text
  return (
    <Fragment>
      {text.slice(0, range.start)}
      <mark className="bg-accent-soft text-ink rounded-sm font-semibold">
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </Fragment>
  )
}
