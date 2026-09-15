import {
  autocompletion,
  completionKeymap,
  type CompletionContext,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { search, searchKeymap } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { useEffect, useRef, useState } from 'react'

import { useFiles } from '@/lib/files/context'

import { campusEditorTheme, campusHighlight } from './editor-theme'

/**
 * The note editor. CodeMirror 6 over one vault note, with autosave that never
 * lies and never loses.
 *
 * The save loop is the part worth reading:
 *
 *   edit → debounce 800ms → writeNote(contents, knownMtime) → stat → new mtime
 *
 * `writeNote` is VAULT-003's conflict check — it refuses if the file changed on
 * disk after we loaded it. So a save can FAIL BY DESIGN, and the states below
 * ('conflict', 'external') exist because a vault is edited by text editors,
 * `git checkout` and the student's own `mv`. External change is normal; losing
 * either version silently is the only forbidden outcome.
 */

export type SaveState =
  | { kind: 'saved' }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  /** The file changed on disk AND we hold unsaved edits. The student decides. */
  | { kind: 'conflict' }

const STATUS_LABEL: Record<SaveState['kind'], string> = {
  saved: 'Guardado',
  dirty: 'Sin guardar',
  saving: 'Guardando…',
  error: 'Error al guardar',
  conflict: 'Cambió afuera',
}

/** How often the open document re-checks the disk underneath it. */
const EXTERNAL_POLL_MS = 5_000
const AUTOSAVE_MS = 800

export function NoteEditor({
  path,
  onWikilink,
  wikilinkTargets,
  onSaved,
}: {
  path: string
  /** Navigate to a [[target]]. The workspace decides what opening means. */
  onWikilink?: (target: string) => void
  /** Known note titles/paths, for `[[` autocomplete. */
  wikilinkTargets?: () => { label: string; detail?: string }[]
  /** Fired after a successful save, so the knowledge index stays incremental. */
  onSaved?: (path: string, contents: string) => void
}) {
  const files = useFiles()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  /** The mtime our next save must present. Mutated by load/save/adopt, never by render. */
  const mtimeRef = useRef<number>(0)
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [status, setStatus] = useState<SaveState>({ kind: 'saved' })
  const [loadError, setLoadError] = useState<string | null>(null)

  // Kept in refs for the callbacks below; state alone would capture stale values
  // inside CodeMirror's update listener, which outlives every render.
  const statusRef = useRef(status)
  statusRef.current = status

  useEffect(() => {
    if (!files || !hostRef.current) return
    let disposed = false

    const save = async (view: EditorView) => {
      if (!dirtyRef.current || statusRef.current.kind === 'conflict') return
      setStatus({ kind: 'saving' })
      const contents = view.state.doc.toString()
      try {
        await files.writeNote(path, contents, mtimeRef.current)
        // Adopt the mtime our own write produced, so the next save presents it.
        const fresh = await files.stat(path)
        if (fresh) mtimeRef.current = fresh.mtimeMs
        dirtyRef.current = false
        if (!disposed) setStatus({ kind: 'saved' })
        onSaved?.(path, contents)
      } catch (error) {
        if (disposed) return
        const message = (error as Error).message
        // A conflict is not an error to retry: the student has two versions of
        // their own work, and retrying would just refuse again.
        if (
          (error as Error).name === 'VaultConflictError' ||
          /changed on disk|cambió/i.test(message)
        ) {
          setStatus({ kind: 'conflict' })
        } else {
          setStatus({ kind: 'error', message })
        }
      }
    }

    const scheduleSave = (view: EditorView) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => void save(view), AUTOSAVE_MS)
    }

    const wikilinkComplete = (context: CompletionContext) => {
      // Trigger only right after `[[` — a Markdown note is prose, and popping
      // completions on ordinary words would make typing miserable.
      const before = context.matchBefore(/\[\[[^\]]*/)
      if (!before) return null
      const query = before.text.slice(2)
      const targets = wikilinkTargets?.() ?? []
      return {
        from: before.from + 2,
        options: targets
          .filter((t) => t.label.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 12)
          .map((t) => ({ label: t.label, detail: t.detail, type: 'text' })),
      }
    }

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: '',
        extensions: [
          history(),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          campusEditorTheme,
          campusHighlight,
          EditorView.lineWrapping,
          search({ top: true }),
          autocompletion({ override: [wikilinkComplete] }),
          keymap.of([
            {
              key: 'Mod-s',
              run: (v) => {
                if (timerRef.current) clearTimeout(timerRef.current)
                void save(v)
                return true
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              dirtyRef.current = true
              if (statusRef.current.kind !== 'conflict') setStatus({ kind: 'dirty' })
              scheduleSave(update.view)
            }
          }),
          EditorView.domEventHandlers({
            click: (event, v) => {
              // Mod+click on a [[wikilink]] navigates. Plain click keeps editing —
              // a note is for writing first.
              if (!(event.metaKey || event.ctrlKey) || !onWikilink) return false
              const pos = v.posAtCoords({ x: event.clientX, y: event.clientY })
              if (pos == null) return false
              const line = v.state.doc.lineAt(pos)
              const re = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g
              let match: RegExpExecArray | null
              while ((match = re.exec(line.text)) !== null) {
                const start = line.from + match.index
                const end = start + match[0].length
                if (pos >= start && pos <= end) {
                  onWikilink(match[1]!.trim())
                  return true
                }
              }
              return false
            },
          }),
        ],
      }),
    })
    viewRef.current = view

    void files
      .readNote(path)
      .then((note) => {
        if (disposed) return
        mtimeRef.current = note.mtimeMs
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: note.contents },
        })
        dirtyRef.current = false
        setStatus({ kind: 'saved' })
      })
      .catch((error) => {
        if (!disposed) setLoadError((error as Error).message)
      })

    // The disk under an open document is not ours alone. Poll its mtime (and
    // re-check on window focus, the moment a student returns from their other
    // editor). Clean reload when we hold no edits; a decision when we do.
    const checkExternal = async () => {
      if (disposed || statusRef.current.kind === 'saving') return
      try {
        const fresh = await files.stat(path)
        if (disposed || !fresh || fresh.mtimeMs === mtimeRef.current) return
        if (!dirtyRef.current) {
          const note = await files.readNote(path)
          if (disposed) return
          mtimeRef.current = note.mtimeMs
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: note.contents },
          })
          setStatus({ kind: 'saved' })
        } else {
          setStatus({ kind: 'conflict' })
        }
      } catch {
        // A transient stat failure must not spam the student; the next poll retries.
      }
    }
    const interval = setInterval(() => void checkExternal(), EXTERNAL_POLL_MS)
    const onFocus = () => void checkExternal()
    window.addEventListener('focus', onFocus)

    return () => {
      disposed = true
      if (timerRef.current) clearTimeout(timerRef.current)
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      view.destroy()
      viewRef.current = null
    }
    // The editor's whole lifecycle is keyed to the note it edits.
  }, [files, path, onWikilink, wikilinkTargets, onSaved])

  const resolveConflict = async (keepMine: boolean) => {
    const view = viewRef.current
    if (!files || !view) return
    if (keepMine) {
      // Adopt the disk's current mtime as our base, so OUR version wins the
      // next write. Explicit choice — never the silent default.
      const fresh = await files.stat(path)
      if (fresh) mtimeRef.current = fresh.mtimeMs
      dirtyRef.current = true
      setStatus({ kind: 'dirty' })
      await files.writeNote(path, view.state.doc.toString(), mtimeRef.current)
      const after = await files.stat(path)
      if (after) mtimeRef.current = after.mtimeMs
      dirtyRef.current = false
      setStatus({ kind: 'saved' })
    } else {
      const note = await files.readNote(path)
      mtimeRef.current = note.mtimeMs
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: note.contents } })
      dirtyRef.current = false
      setStatus({ kind: 'saved' })
    }
  }

  if (!files) {
    return (
      <p className="text-ink-muted p-6 text-sm">
        El editor necesita un Vault local. Abrí uno desde el inicio.
      </p>
    )
  }

  if (loadError) {
    return (
      <div className="p-6" role="alert">
        <p className="text-danger text-sm font-medium">No pudimos abrir esta nota.</p>
        <p className="text-ink-muted mt-1 text-sm">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {status.kind === 'conflict' && (
        <div
          role="alert"
          className="border-warning/40 bg-warning/5 flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
        >
          <span className="font-medium">Este archivo cambió fuera de Campus.</span>
          <button
            type="button"
            onClick={() => void resolveConflict(false)}
            className="border-rule rounded-md border px-2 py-0.5 text-xs"
          >
            Recargar del disco
          </button>
          <button
            type="button"
            onClick={() => void resolveConflict(true)}
            className="border-rule rounded-md border px-2 py-0.5 text-xs"
          >
            Conservar mi versión
          </button>
        </div>
      )}
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" data-testid="note-editor" />
      <div
        // Shares the text axis with the ruled lines above it.
        className="border-rule text-ink-muted flex items-center justify-between border-t px-4 py-1 text-xs md:pr-[var(--rule-gutter)] md:pl-[var(--rule-text-inset)]"
        aria-live="polite"
      >
        <span className="truncate">{path}</span>
        <span
          className={
            status.kind === 'error' || status.kind === 'conflict'
              ? 'text-danger font-medium'
              : ''
          }
        >
          {STATUS_LABEL[status.kind]}
        </span>
      </div>
    </div>
  )
}
