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
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { useEffect, useRef, useState } from 'react'

import { useFiles } from '@/lib/files/context'
import { vaultErrorMessage } from '@/lib/files/errors'
import { NoteAutosave, type SaveState } from '@/lib/workspace/autosave'

import { campusEditorTheme, campusHighlight } from './editor-theme'

/**
 * The note editor. CodeMirror 6 over one vault note, with autosave that never
 * lies and never loses.
 *
 * The save loop lives in `lib/workspace/autosave.ts` — read its header for the
 * rules. This component is the wiring: it feeds document changes in, shows the
 * state out, and lends the workspace a handle so a tab is never closed on top of
 * edits that have not reached the disk.
 */

export type { SaveState }

/**
 * What the workspace may ask of an open editor. `flush` resolves when
 * everything typed so far is on disk or has definitively failed; `unsaved`
 * then says which.
 */
export interface EditorHandle {
  path: string
  flush(): Promise<void>
  unsaved(): boolean
}

const STATUS_LABEL: Record<SaveState['kind'], string> = {
  saved: 'Guardado',
  dirty: 'Sin guardar',
  saving: 'Guardando…',
  error: 'Error al guardar',
  conflict: 'Cambió afuera',
  missing: 'Sin archivo',
}

/** How often the open document re-checks the disk underneath it. */
const EXTERNAL_POLL_MS = 5_000

export function NoteEditor({
  path,
  onWikilink,
  wikilinkTargets,
  onSaved,
  registerEditor,
  onClose,
}: {
  path: string
  /** Navigate to a [[target]]. The workspace decides what opening means. */
  onWikilink?: (target: string) => void
  /** Known note titles/paths, for `[[` autocomplete. */
  wikilinkTargets?: () => { label: string; detail?: string }[]
  /** Fired after a successful save, so the knowledge index stays incremental. */
  onSaved?: (path: string, contents: string) => void
  /** Lend the workspace a handle for flush-before-close. Returns the unregister. */
  registerEditor?: (handle: EditorHandle) => () => void
  /** The student chose to close this note from the editor itself. */
  onClose?: () => void
}) {
  const files = useFiles()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const autosaveRef = useRef<NoteAutosave | null>(null)

  const [status, setStatus] = useState<SaveState>({ kind: 'saved' })
  const [loadError, setLoadError] = useState<string | null>(null)

  // The callbacks are read through a ref so the editor's lifecycle depends on
  // the note it edits and nothing else: a parent that re-renders with a new
  // function must not tear down a document with unsaved text in it.
  const props = useRef({ onWikilink, wikilinkTargets, onSaved, registerEditor })
  props.current = { onWikilink, wikilinkTargets, onSaved, registerEditor }

  useEffect(() => {
    if (!files || !hostRef.current) return
    let disposed = false
    let autosave: NoteAutosave | null = null

    const wikilinkComplete = (context: CompletionContext) => {
      // Trigger only right after `[[` — a Markdown note is prose, and popping
      // completions on ordinary words would make typing miserable.
      const before = context.matchBefore(/\[\[[^\]]*/)
      if (!before) return null
      const query = before.text.slice(2)
      const targets = props.current.wikilinkTargets?.() ?? []
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
          // The editing surface is a textbox with no label of its own: without
          // this a screen reader announces "edit text, blank".
          EditorView.contentAttributes.of({
            'aria-label': 'Contenido de la nota',
            'aria-multiline': 'true',
          }),
          placeholder('Escribí acá…'),
          search({ top: true }),
          autocompletion({ override: [wikilinkComplete] }),
          keymap.of([
            {
              key: 'Mod-s',
              run: () => {
                void autosave?.save()
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
            if (update.docChanged) autosave?.edited()
          }),
          EditorView.domEventHandlers({
            click: (event, v) => {
              // Mod+click on a [[wikilink]] navigates. Plain click keeps editing —
              // a note is for writing first.
              const navigate = props.current.onWikilink
              if (!(event.metaKey || event.ctrlKey) || !navigate) return false
              const pos = v.posAtCoords({ x: event.clientX, y: event.clientY })
              if (pos == null) return false
              const line = v.state.doc.lineAt(pos)
              const re = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g
              let match: RegExpExecArray | null
              while ((match = re.exec(line.text)) !== null) {
                const start = line.from + match.index
                const end = start + match[0].length
                if (pos >= start && pos <= end) {
                  navigate(match[1]!.trim())
                  return true
                }
              }
              return false
            },
          }),
        ],
      }),
    })

    autosave = new NoteAutosave({
      files,
      path,
      host: {
        readText: () => view.state.doc.toString(),
        replaceText: (text) =>
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
      },
      onState: (next) => {
        if (!disposed) setStatus(next)
      },
      onSaved: (savedPath, contents) => props.current.onSaved?.(savedPath, contents),
    })
    autosaveRef.current = autosave
    const unregister = props.current.registerEditor?.({
      path,
      flush: () => autosave.flush(),
      unsaved: () => autosave.unsaved(),
    })

    void autosave.load().catch((error) => {
      if (!disposed) setLoadError(vaultErrorMessage(error))
    })

    // The disk under an open document is not ours alone. Poll its mtime (and
    // re-check on window focus, the moment a student returns from their other
    // editor). Clean reload when we hold no edits; a decision when we do.
    const interval = setInterval(() => void autosave.checkExternal(), EXTERNAL_POLL_MS)
    const onFocus = () => void autosave.checkExternal()
    window.addEventListener('focus', onFocus)

    return () => {
      disposed = true
      unregister?.()
      // Whatever is still unsaved is written before the view disappears. The
      // workspace awaits `flush()` first where it can warn; this is the net
      // under every path that unmounts without asking (route change, pane close).
      autosave.disposeAndFlush()
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      view.destroy()
      autosaveRef.current = null
    }
    // The editor's whole lifecycle is keyed to the note it edits.
  }, [files, path])

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

  const autosave = autosaveRef.current

  return (
    <div className="flex h-full min-h-0 flex-col">
      {status.kind === 'conflict' && (
        <div
          role="alert"
          className="border-warning/40 bg-warning/5 flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
        >
          <span className="font-medium">Este archivo cambió fuera de Campus.</span>
          <BannerButton onClick={() => void autosave?.reload()}>
            Recargar del disco
          </BannerButton>
          <BannerButton onClick={() => void autosave?.keepMine()}>
            Conservar mi versión
          </BannerButton>
        </div>
      )}
      {status.kind === 'missing' && (
        <div
          role="alert"
          className="border-warning/40 bg-warning/5 flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
        >
          <span className="font-medium">Esta nota se movió o se eliminó.</span>
          <BannerButton onClick={() => void autosave?.saveAsNew()}>
            Guardar como nueva
          </BannerButton>
          <BannerButton onClick={() => onClose?.()}>Cerrar</BannerButton>
        </div>
      )}
      {status.kind === 'error' && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/5 flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
        >
          <span className="font-medium">{status.message}</span>
        </div>
      )}
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" data-testid="note-editor" />
      <div
        // Shares the text axis with the ruled lines above it. The file name is
        // NOT repeated here: the tab and the masthead already show it.
        className="border-rule text-ink-muted flex items-center justify-end border-t px-4 py-1 text-xs md:pr-[var(--rule-gutter)] md:pl-[var(--rule-text-inset)]"
        aria-live="polite"
      >
        <span
          className={
            status.kind === 'error' || status.kind === 'conflict' || status.kind === 'missing'
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

function BannerButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-rule rounded-md border px-2 py-0.5 text-xs"
    >
      {children}
    </button>
  )
}
