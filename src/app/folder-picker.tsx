import { ChevronRight, CornerLeftUp, Folder } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { vaultErrorCode } from '@/lib/vault/errors'
import type { FolderListing } from '@/lib/vault/http-vault-access'
import { cn } from '@/lib/utils'

/**
 * Choose a folder on the machine that runs Campus.
 *
 * Not a browser file dialog, on purpose: Campus may be open on a laptop while the
 * folders live on another computer, so the list comes from the server, which also
 * decides what may be shown. The model is Finder's / Explorer's, the one a
 * student already knows: a breadcrumb for where you are, a list of what is
 * inside, go in, go up, and one button that takes THIS folder.
 *
 * The list is the same ARIA combobox/listbox as the search palette: the filter
 * input keeps focus and owns `aria-activedescendant`, so the arrows move a
 * highlight without ever moving focus into the list. A native `<dialog>` gives
 * the focus trap, the inert background and Escape.
 */

type Problem = 'unavailable' | 'refused'

const MESSAGES: Record<Problem, string> = {
  unavailable:
    'Perdimos la conexión con tu computadora. Revisá que Campus siga abierto y reintentá.',
  // One sentence for every reason (missing, outside the allowed folders,
  // unreadable): which of them it is would tell a page about the disk.
  refused: 'No podemos mostrar esa carpeta. Elegí otra desde el camino de arriba.',
}

/** Compare names without caring about case or accents: "musica" finds "Música". */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Paths are the server's, so they may use either separator; never normalise them here. */
const separatorOf = (path: string) => (path.includes('\\') && !path.includes('/') ? '\\' : '/')
const trimEnd = (path: string) => path.replace(/[\\/]+$/, '')
const baseName = (path: string) => trimEnd(path).split(/[\\/]/).pop() || path

const join = (base: string, name: string) => `${trimEnd(base)}${separatorOf(base)}${name}`

export function FolderPicker({
  listFolders,
  onChoose,
  onClose,
}: {
  listFolders: (path?: string) => Promise<FolderListing>
  onChoose: (path: string) => void
  onClose: () => void
}) {
  const listId = useId()
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const request = useRef(0)
  const lastPath = useRef<string | undefined>(undefined)

  const [current, setCurrent] = useState<FolderListing | null>(null)
  const [root, setRoot] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [filter, setFilter] = useState('')
  const [active, setActive] = useState(0)

  const go = useCallback(
    async (path?: string) => {
      const mine = ++request.current
      lastPath.current = path
      setLoading(true)
      setProblem(null)
      try {
        const next = await listFolders(path)
        // A slower, older answer must not overwrite the folder the student is in now.
        if (mine !== request.current) return
        setCurrent(next)
        // The first folder the server offers is the top: nothing above it can be shown.
        setRoot((known) => known ?? next.path)
        setFilter('')
        setActive(0)
        // Wherever focus was (a breadcrumb, the Up button that has just been
        // disabled), the next thing to do in a new folder is look in it.
        inputRef.current?.focus()
      } catch (cause) {
        if (mine !== request.current) return
        setProblem(vaultErrorCode(cause) === 'unavailable' ? 'unavailable' : 'refused')
      } finally {
        if (mine === request.current) setLoading(false)
      }
    },
    [listFolders],
  )

  useEffect(() => {
    const dialog = dialogRef.current
    // jsdom has no showModal; everything else does, and the fallback is only
    // the visible state, which is all a test needs.
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    inputRef.current?.focus()
    void go()
    // Opened once per mount: the parent mounts a fresh picker each time.
  }, [go])

  const names = useMemo(() => {
    const wanted = fold(filter.trim())
    return (current?.dirs ?? []).filter((name) => fold(name).includes(wanted))
  }, [current, filter])

  useEffect(() => setActive(0), [filter])

  const crumbs = useMemo(() => {
    if (!current || !root) return []
    const below = current.path
      .slice(trimEnd(root).length)
      .split(/[\\/]/)
      .filter((part) => part.length > 0)
    const out = [{ label: 'Inicio', path: root }]
    let path = root
    for (const part of below) {
      path = join(path, part)
      out.push({ label: part, path })
    }
    return out
  }, [current, root])

  const enter = (name: string | undefined) => {
    if (name !== undefined && current) void go(join(current.path, name))
  }
  const up = () => {
    if (current?.parent) void go(current.parent)
  }
  const choose = () => {
    if (current && !loading) onChoose(current.path)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (names.length === 0 ? 0 : Math.min(i + 1, names.length - 1)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      // Going in and choosing are different keys, so they cannot be confused.
      if (event.ctrlKey || event.metaKey) choose()
      else enter(names[active])
    } else if (
      (event.key === 'Backspace' && filter.length === 0) ||
      (event.key === 'ArrowLeft' && event.altKey)
    ) {
      event.preventDefault()
      up()
    }
  }

  const hasListing = current !== null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="border-rule bg-paper-elevated text-ink m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border p-0 shadow-lg backdrop:bg-black/30"
    >
      <div className="flex flex-col">
        <div className="border-rule-soft flex items-center gap-2 border-b px-4 py-3">
          <h2 id={titleId} className="font-serif text-lg">
            Elegir carpeta
          </h2>
        </div>

        <div className="border-rule-soft flex items-center gap-2 border-b px-3 py-2">
          <button
            type="button"
            aria-label="Subir un nivel"
            disabled={!current?.parent || loading}
            onClick={up}
            className="text-ink-muted hover:bg-paper-sunken hover:text-ink inline-flex size-8 shrink-0 items-center justify-center rounded-md disabled:opacity-40"
          >
            <CornerLeftUp aria-hidden="true" className="size-4" />
          </button>
          <nav aria-label="Ruta" className="min-w-0 flex-1">
            <ol className="flex flex-wrap items-center gap-x-1 text-sm">
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1
                return (
                  <li key={crumb.path} className="flex items-center gap-1">
                    {index > 0 ? (
                      <ChevronRight aria-hidden="true" className="text-ink-faint size-3.5" />
                    ) : null}
                    {last ? (
                      <span aria-current="page" className="font-medium">
                        {crumb.label}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void go(crumb.path)}
                        className="text-ink-muted hover:text-ink underline-offset-4 hover:underline"
                      >
                        {crumb.label}
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        </div>

        <div className="px-4 pt-3">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Filtrar carpetas"
            aria-expanded={names.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={names.length > 0 ? `${listId}-option-${active}` : undefined}
            placeholder="Filtrar carpetas…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={onKeyDown}
            className="border-field bg-paper-elevated placeholder:text-ink-faint h-9 w-full rounded-md border px-3 text-sm"
          />
        </div>

        <div className="min-h-48 px-1 py-2" aria-busy={loading}>
          {problem ? (
            <div role="alert" className="text-danger px-3 py-2 text-sm">
              <p>{MESSAGES[problem]}</p>
              {problem === 'unavailable' ? (
                <button
                  type="button"
                  onClick={() => void go(lastPath.current)}
                  className="text-accent-ink mt-2 font-medium underline-offset-4 hover:underline"
                >
                  Reintentar
                </button>
              ) : null}
            </div>
          ) : null}

          {!hasListing && loading ? (
            <p role="status" className="text-ink-muted px-3 py-2 text-sm">
              Abriendo carpeta…
            </p>
          ) : null}

          {hasListing ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Carpetas"
              // A click on a row must not pull focus out of the filter: the
              // keyboard (Backspace to go up, Enter to go in) keeps working.
              onMouseDown={(event) => event.preventDefault()}
              className={cn('max-h-64 overflow-y-auto', loading && 'opacity-60')}
            >
              {names.map((name, index) => (
                // The option IS the row: a focusable control inside would be
                // axe's nested-interactive. Focus stays on the filter input,
                // which owns the highlight; mouse handlers are the pointer's path.
                <li
                  key={name}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => setActive(index)}
                  onDoubleClick={() => enter(name)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm',
                    index === active ? 'bg-accent-soft' : 'hover:bg-paper-sunken',
                  )}
                >
                  <Folder aria-hidden="true" className="text-ink-faint size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <ChevronRight aria-hidden="true" className="text-ink-faint size-4 shrink-0" />
                </li>
              ))}
            </ul>
          ) : null}

          {hasListing && names.length === 0 && !loading ? (
            <p className="text-ink-muted px-3 py-2 text-sm">
              {filter.trim().length > 0
                ? `Ninguna carpeta se llama «${filter.trim()}». Probá con menos letras.`
                : 'No hay carpetas acá adentro. Podés usar esta misma carpeta o volver atrás.'}
            </p>
          ) : null}
        </div>

        <div className="border-rule-soft flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-ink-muted min-w-0 truncate text-sm">
            {current ? `Vas a usar: ${baseName(current.path)}` : ''}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!current || loading}
              onClick={choose}
            >
              Usar esta carpeta
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
