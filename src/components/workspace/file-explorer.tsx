import { useState } from 'react'

import { useVaultDir, useVaultMutations } from '@/features/vault/queries'
import type { VaultEntry } from '@/lib/files/context'

/**
 * The vault explorer: the student's real folder, shown as it is.
 *
 * Two rules shape it. Every mutation goes through the files capability — the
 * explorer composes NO paths beyond joining a parent it listed with a name the
 * student typed, and every one of those is judged again server-side by the
 * single authority. And destructive actions are never one click: delete asks,
 * and "delete" is trash-not-unlink underneath, so even a confirmed mistake is
 * recoverable by hand.
 */

const join = (parent: string, name: string) => (parent === '' ? name : `${parent}/${name}`)

export interface ExplorerEvents {
  onOpen: (path: string) => void
  /** Open tabs must follow a renamed file — the shell routes this to the model. */
  onRenamed?: (from: string, to: string) => void
  /** A trashed note closes everywhere. */
  onTrashed?: (path: string) => void
}

export function FileExplorer({
  activePath,
  ...events
}: { activePath: string | null } & ExplorerEvents) {
  return (
    <nav aria-label="Archivos del Vault" className="flex h-full flex-col overflow-y-auto p-2">
      <Directory path="" depth={0} activePath={activePath} events={events} alwaysOpen />
    </nav>
  )
}

function Directory({
  path,
  depth,
  activePath,
  events,
  alwaysOpen = false,
}: {
  path: string
  depth: number
  activePath: string | null
  events: ExplorerEvents
  alwaysOpen?: boolean
}) {
  const { onOpen } = events
  const dir = useVaultDir(path)
  const mutations = useVaultMutations()
  const [creating, setCreating] = useState<'note' | 'folder' | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submitCreate = async () => {
    const name = draft.trim()
    if (!name || !creating) return
    setError(null)
    try {
      if (creating === 'note') {
        const file = name.endsWith('.md') ? name : `${name}.md`
        const target = join(path, file)
        await mutations.createNote.mutateAsync({ path: target })
        onOpen(target)
      } else {
        await mutations.createFolder.mutateAsync(join(path, name))
      }
      setCreating(null)
      setDraft('')
    } catch (cause) {
      // The refusal names the reason (invalid name, conflict, escape). The
      // student typed the name; the message is theirs to read.
      setError((cause as Error).message)
    }
  }

  if (dir.isLoading) {
    return <p className="text-ink-muted px-2 py-1 text-xs">Leyendo…</p>
  }
  if (dir.isError) {
    return (
      <p role="alert" className="text-danger px-2 py-1 text-xs">
        No pudimos leer esta carpeta.
      </p>
    )
  }

  const entries = dir.data ?? []

  return (
    <div className="flex flex-col gap-px">
      {path === '' && (
        <div className="mb-1 flex gap-1 px-1">
          <button
            type="button"
            onClick={() => setCreating(creating === 'note' ? null : 'note')}
            className="border-rule text-ink-muted hover:text-ink rounded-md border px-2 py-0.5 text-xs"
          >
            + Nota
          </button>
          <button
            type="button"
            onClick={() => setCreating(creating === 'folder' ? null : 'folder')}
            className="border-rule text-ink-muted hover:text-ink rounded-md border px-2 py-0.5 text-xs"
          >
            + Carpeta
          </button>
        </div>
      )}

      {creating && (
        <form
          className="px-1 py-0.5"
          onSubmit={(e) => {
            e.preventDefault()
            void submitCreate()
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (setCreating(null), setDraft(''))}
            placeholder={creating === 'note' ? 'nombre-de-la-nota' : 'nombre-de-carpeta'}
            aria-label={
              creating === 'note' ? 'Nombre de la nota nueva' : 'Nombre de la carpeta nueva'
            }
            className="border-rule w-full rounded-md border px-2 py-1 text-xs"
          />
          {error && (
            <p role="alert" className="text-danger mt-0.5 text-xs">
              {error}
            </p>
          )}
        </form>
      )}

      {entries.length === 0 && !creating && path === '' && (
        <p className="text-ink-muted px-2 py-4 text-center text-xs">
          Tu Vault está vacío. Creá tu primera nota.
        </p>
      )}

      {entries.map((entry) => (
        <Entry
          key={entry.name}
          entry={entry}
          parent={path}
          depth={depth}
          activePath={activePath}
          events={events}
        />
      ))}
      {void alwaysOpen}
    </div>
  )
}

function Entry({
  entry,
  parent,
  depth,
  activePath,
  events,
}: {
  entry: VaultEntry
  parent: string
  depth: number
  activePath: string | null
  events: ExplorerEvents
}) {
  const { onOpen } = events
  const path = join(parent, entry.name)
  const mutations = useVaultMutations()
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(entry.name)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isActive = activePath === path
  const indent = { paddingLeft: `${depth * 0.75 + 0.25}rem` }

  const submitRename = async () => {
    const name = draft.trim()
    if (!name || name === entry.name) {
      setRenaming(false)
      return
    }
    try {
      const to = join(parent, name)
      await mutations.rename.mutateAsync({ from: path, to })
      events.onRenamed?.(path, to)
      setRenaming(false)
      setError(null)
    } catch (cause) {
      setError((cause as Error).message)
    }
  }

  const submitTrash = async () => {
    try {
      await mutations.trash.mutateAsync(path)
      events.onTrashed?.(path)
      setConfirming(false)
    } catch (cause) {
      setError((cause as Error).message)
    }
  }

  if (renaming) {
    return (
      <form
        style={indent}
        className="py-0.5 pr-1"
        onSubmit={(e) => {
          e.preventDefault()
          void submitRename()
        }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
          aria-label={`Renombrar ${entry.name}`}
          className="border-rule w-full rounded-md border px-2 py-0.5 text-xs"
        />
        {error && (
          <p role="alert" className="text-danger text-xs">
            {error}
          </p>
        )}
      </form>
    )
  }

  return (
    <div>
      <div
        style={indent}
        className={`group flex items-center gap-1 rounded-md pr-1 ${
          isActive ? 'bg-paper-sunken text-ink font-medium' : 'text-ink-muted hover:text-ink'
        }`}
      >
        <button
          type="button"
          onClick={() => (entry.kind === 'dir' ? setOpen(!open) : onOpen(path))}
          onDoubleClick={() => setRenaming(true)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-sm"
          aria-current={isActive ? 'true' : undefined}
          aria-expanded={entry.kind === 'dir' ? open : undefined}
        >
          <span aria-hidden className="text-ink-faint w-3 shrink-0 text-center text-xs">
            {entry.kind === 'dir' ? (open ? '▾' : '▸') : '·'}
          </span>
          <span className="truncate">{entry.name.replace(/\.md$/, '')}</span>
        </button>
        <span className="hidden shrink-0 gap-0.5 group-focus-within:flex group-hover:flex">
          <button
            type="button"
            onClick={() => {
              setDraft(entry.name)
              setRenaming(true)
            }}
            aria-label={`Renombrar ${entry.name}`}
            className="text-ink-faint hover:text-ink px-1 text-xs"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Eliminar ${entry.name}`}
            className="text-ink-faint hover:text-danger px-1 text-xs"
          >
            ✕
          </button>
        </span>
      </div>

      {confirming && (
        <div
          style={indent}
          role="alertdialog"
          aria-label={`Confirmar eliminación de ${entry.name}`}
          className="py-1"
        >
          <p className="text-ink text-xs">
            ¿Eliminar <strong>{entry.name}</strong>? Va a la papelera del Vault (
            <code className="text-[10px]">.campus/trash/</code>), recuperable a mano.
          </p>
          <div className="mt-1 flex gap-1">
            <button
              type="button"
              onClick={() => void submitTrash()}
              className="border-danger/40 text-danger rounded-md border px-2 py-0.5 text-xs"
            >
              Eliminar
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="border-rule rounded-md border px-2 py-0.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && !renaming && (
        <p role="alert" style={indent} className="text-danger text-xs">
          {error}
        </p>
      )}

      {entry.kind === 'dir' && open && (
        <Directory path={path} depth={depth + 1} activePath={activePath} events={events} />
      )}
    </div>
  )
}
