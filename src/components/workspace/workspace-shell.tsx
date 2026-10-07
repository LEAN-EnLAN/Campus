import { FileText } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'

import {
  activatePane,
  activateTab,
  closePath,
  closeTab,
  deserialize,
  openNote,
  renamePath,
  serialize,
  splitPane,
  workspaceStorageKey,
  type WorkspaceState,
} from '@/lib/workspace/model'

import { useFiles } from '@/lib/files/context'
import { vaultErrorCode, vaultErrorMessage } from '@/lib/files/errors'
import { KnowledgeProvider, useKnowledge } from '@/lib/knowledge/provider'

import { BacklinksPanel } from './backlinks-panel'
import { useEditorGuard } from './editor-guard'
import { FileExplorer } from './file-explorer'
import { NoteEditor } from './note-editor'
import { QuickSwitcher } from './quick-switcher'
import { SearchDialog } from './search-dialog'

/**
 * The workspace shell: explorer beside a pane group, tabs above each pane.
 *
 *     ┌ sidebar ┬ pane (tabs / editor) ┬ pane ┐
 *
 * Layout state is DEVICE-local and PER-VAULT (`workspaceStorageKey`): two
 * vaults must not share tab state, and none of this ever goes inside the vault
 * — a synced folder must not carry one machine's window arrangement to another.
 *
 * Responsive shape: at <768px the sidebar becomes an overlay sheet and only the
 * active pane renders — a second pane is not "hidden", it simply does not exist
 * as a concept the student has to manage on a phone.
 */

export interface WorkspaceShellProps {
  vaultKey: string
  /** A note the app asked to open (global search). Reported back via `onOpenRequestHandled`. */
  openRequest?: string | null
  onOpenRequestHandled?: () => void
  /**
   * Receives the "may I leave?" check: flushes every open editor and, only if
   * some text could not be saved, asks. The route calls it before navigating
   * away from the workspace.
   */
  onGuard?: (settle: () => Promise<boolean>) => void
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <KnowledgeProvider>
      <WorkspaceShellInner {...props} />
    </KnowledgeProvider>
  )
}

function WorkspaceShellInner({
  vaultKey,
  openRequest,
  onOpenRequestHandled,
  onGuard,
}: WorkspaceShellProps) {
  const storageKey = workspaceStorageKey(vaultKey)
  const [state, setState] = useState<WorkspaceState>(() =>
    deserialize(localStorage.getItem(storageKey)),
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const files = useFiles()
  const knowledge = useKnowledge()
  const guard = useEditorGuard()
  // A gesture that failed, said in Spanish. Cleared by the next one that works.
  const [notice, setNotice] = useState<string | null>(null)
  const [createRequest, setCreateRequest] = useState(0)

  // Persist on every change, debounced by the event loop — layout writes are
  // tiny and losing one to a crash costs nothing.
  useEffect(() => {
    localStorage.setItem(storageKey, serialize(state))
  }, [state, storageKey])

  const active = state.panes.find((p) => p.id === state.activePaneId) ?? state.panes[0]!
  const activePath = active.activeTab

  const stateRef = useRef(state)
  stateRef.current = state

  /**
   * Opening a note replaces the editor of the active tab, so whatever is typed
   * there is settled first. If it cannot be saved and the student declines to
   * lose it, nothing changes.
   */
  const open = useCallback(
    (path: string) => {
      void (async () => {
        const current = stateRef.current
        const pane = current.panes.find((p) => p.id === current.activePaneId)
        const leaving = pane?.activeTab
        if (leaving && leaving !== path && !(await guard.settle((p) => p === leaving))) return
        setState((s) => openNote(s, path))
        knowledge.noteOpened(path)
      })()
    },
    [knowledge, guard],
  )

  const openRef = useRef(open)
  openRef.current = open

  /** Close a tab, saving what it holds first. */
  const requestClose = useCallback(
    async (paneId: string, path: string) => {
      if (!(await guard.settle((p) => p === path))) return
      setState((s) => closeTab(s, paneId, path))
    },
    [guard],
  )

  /** Switch tabs inside a pane: the editor being left is settled first. */
  const requestActivate = useCallback(
    async (paneId: string, path: string) => {
      const pane = stateRef.current.panes.find((p) => p.id === paneId)
      const leaving = pane?.activeTab
      if (leaving && leaving !== path && !(await guard.settle((p) => p === leaving))) return
      setState((s) => activateTab(activatePane(s, paneId), paneId, path))
    },
    [guard],
  )

  useEffect(() => {
    onGuard?.(() => guard.settle())
  }, [guard, onGuard])

  // A note the app asked for (global search): open it, then say it was handled
  // so the request is not replayed on the next render.
  const handledRequest = useRef<string | null>(null)
  const handledCallback = useRef(onOpenRequestHandled)
  handledCallback.current = onOpenRequestHandled
  useEffect(() => {
    // Keyed on the request alone: `open` changes whenever the index does, and
    // replaying a request on every such change would loop.
    if (!openRequest || handledRequest.current === openRequest) return
    handledRequest.current = openRequest
    openRef.current(openRequest)
    handledCallback.current?.()
  }, [openRequest])

  const knowledgeRef = useRef(knowledge)
  knowledgeRef.current = knowledge
  const filesRef = useRef(files)
  filesRef.current = files

  // "Nota de hoy": Daily/YYYY-MM-DD.md, created from a tiny template on first
  // use, just opened afterwards. The date is built from LOCAL components —
  // Argentina is UTC-3 and toISOString() would file tonight's note under
  // tomorrow.
  //
  // Every step either works or says why it did not. A failed create used to
  // open a phantom note and index the template; a failed existence check used
  // to be read as "absent", so the template was written over the real note.
  const openDailyNote = useCallback(async () => {
    const files = filesRef.current
    if (!files) return
    const now = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const path = `Daily/${stamp}.md`
    try {
      const existing = await files.stat(path)
      if (!existing) {
        const body = `---\ndate: ${stamp}\ntype: daily\n---\n\n# ${stamp}\n\n- [ ] \n`
        try {
          await files.writeNote(path, body, null)
          knowledgeRef.current.noteCreated(path, body)
        } catch (error) {
          // Created in the meantime (another tab, a sync): it exists, so open it.
          if (vaultErrorCode(error) !== 'already_exists') throw error
        }
      }
      setNotice(null)
      openRef.current(path)
    } catch (error) {
      setNotice(vaultErrorMessage(error))
    }
  }, [])

  // [[Target]] resolution goes through the index: exact path, then unique
  // title, then unique basename. A MISSING target creates the note — that is
  // the wiki gesture, linking into existence. Ambiguity opens nothing and is
  // surfaced, because guessing between two "Parcial.md"s is how a student
  // writes into the wrong course.
  const onWikilink = useCallback((target: string) => {
    const verdict = knowledgeRef.current.index.resolve(target)
    if (verdict.status === 'resolved') {
      openRef.current(verdict.path)
    } else if (verdict.status === 'ambiguous') {
      setNotice(`«${target}» puede ser más de una nota: ${verdict.candidates.join(', ')}.`)
    } else {
      const path = /\.md$/i.test(target) ? target : `${target}.md`
      void (async () => {
        try {
          await filesRef.current?.writeNote(path, `# ${target}\n\n`, null)
          knowledgeRef.current.noteCreated(path, `# ${target}\n\n`)
          setNotice(null)
          openRef.current(path)
        } catch (error) {
          // The vault refused the name (invalid, or created meanwhile): say so,
          // and open nothing rather than a note that does not exist.
          setNotice(vaultErrorMessage(error))
        }
      })()
    }
  }, [])

  // Autocomplete after [[ offers real titles from the index.
  const wikilinkTargets = useCallback(
    () =>
      knowledgeRef.current.index
        .notes()
        .map((n) => ({ label: n.title, detail: n.path }))
        .slice(0, 200),
    [],
  )

  const shortcuts = useMemo(
    () => ({
      split: () => setState((s) => splitPane(s)),
      closeActive: () => {
        const s = stateRef.current
        const pane = s.panes.find((p) => p.id === s.activePaneId)
        if (pane?.activeTab) void requestClose(pane.id, pane.activeTab)
      },
      toggleSidebar: () => setSidebarOpen((v) => !v),
    }),
    [requestClose],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      if (event.key === '\\') {
        event.preventDefault()
        shortcuts.split()
      } else if (event.key.toLowerCase() === 'w') {
        // Browser-critical shortcut: only claim it when a tab is open to close,
        // so Ctrl+W on an empty workspace still closes the browser tab the
        // student actually meant.
        const pane = state.panes.find((p) => p.id === state.activePaneId)
        if (pane?.activeTab) {
          event.preventDefault()
          shortcuts.closeActive()
        }
      } else if (event.key.toLowerCase() === 'b') {
        event.preventDefault()
        shortcuts.toggleSidebar()
      } else if (event.key.toLowerCase() === 'p' && !event.shiftKey) {
        event.preventDefault()
        setSwitcherOpen(true)
      } else if (event.key.toLowerCase() === 'f' && event.shiftKey) {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts, state])

  // Explorer mutations must not orphan tabs: rename/trash flow through the
  // model so an open note follows its file.
  const beforeChange = useCallback(
    (path: string) => guard.settle((p) => p === path || p.startsWith(path + '/')),
    [guard],
  )
  const handleRenamed = useCallback(
    (from: string, to: string) => {
      setState((s) => renamePath(s, from, to))
      knowledge.noteRenamed(from, to)
    },
    [knowledge],
  )
  const handleTrashed = useCallback(
    (path: string) => {
      setState((s) => closePath(s, path))
      knowledge.noteTrashed(path)
    },
    [knowledge],
  )
  const handleSaved = useCallback((path: string, contents: string) => {
    knowledgeRef.current.noteSaved(path, contents)
  }, [])

  return (
    <div className="flex h-full min-h-0">
      <QuickSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} onOpen={open} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onOpen={open} />
      {/* Sidebar: fixed panel ≥768, overlay sheet below. */}
      {sidebarOpen && (
        <>
          <div
            className="bg-ink/20 fixed inset-0 z-20 md:hidden"
            aria-hidden
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            aria-label="Explorador de notas"
            className="bg-paper border-rule fixed inset-y-0 left-0 z-30 w-72 border-r md:static md:z-auto md:w-60 md:shrink-0 lg:w-72"
          >
            <div className="flex items-center justify-between px-3 py-2 md:hidden">
              <span className="text-ink text-sm font-medium">Archivos</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Cerrar explorador"
                className="text-ink-muted px-2"
              >
                ✕
              </button>
            </div>
            <button
              type="button"
              onClick={() => void openDailyNote()}
              className="border-rule text-ink-muted hover:text-ink mx-2 mt-2 rounded-md border border-dashed px-2 py-1 text-left text-xs"
            >
              ☀ Nota de hoy
            </button>
            <FileExplorer
              activePath={activePath}
              createRequest={createRequest}
              onBeforeChange={beforeChange}
              onOpen={(p) => (open(p), setSidebarOpen(window.innerWidth >= 768))}
              onRenamed={handleRenamed}
              onTrashed={handleTrashed}
            />
          </aside>
        </>
      )}

      <div className="bg-paper-sunken/45 relative flex min-w-0 flex-1 overflow-hidden">
        {notice && (
          <p
            role="alert"
            className="border-warning/40 bg-paper-elevated text-ink absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <span>{notice}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setNotice(null)}
              className="text-ink-muted shrink-0 px-1"
            >
              ✕
            </button>
          </p>
        )}
        {state.panes.map((pane, index) => {
          const isActivePane = pane.id === state.activePaneId
          // Mobile: only the active pane exists. Desktop: both, split evenly.
          const hiddenOnMobile = !isActivePane ? 'hidden md:flex' : 'flex'
          return (
            <section
              key={pane.id}
              aria-label={`Panel ${index + 1}`}
              onFocusCapture={() => setState((s) => activatePane(s, pane.id))}
              className={`${hiddenOnMobile} min-w-0 flex-1 flex-col ${
                index > 0 ? 'border-rule border-l' : ''
              } ${isActivePane && state.panes.length > 1 ? 'bg-paper-sunken/45' : ''}`}
            >
              <div
                aria-label={`Pestañas del panel ${index + 1}`}
                className="border-rule flex items-center gap-px overflow-x-auto border-b px-1"
              >
                {!sidebarOpen && index === 0 && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Abrir explorador"
                    className="text-ink-muted shrink-0 px-2 py-1.5 text-sm"
                  >
                    ☰
                  </button>
                )}
                {pane.tabs.map((tab) => (
                  <div
                    key={tab}
                    className={`flex shrink-0 items-center rounded-t-md ${
                      pane.activeTab === tab
                        ? 'bg-paper-elevated text-ink'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <button
                      type="button"
                      aria-current={pane.activeTab === tab ? 'true' : undefined}
                      onClick={() => void requestActivate(pane.id, tab)}
                      className="max-w-44 truncate px-2.5 py-1.5 text-xs"
                      title={tab}
                    >
                      {(tab.split('/').pop() ?? tab).replace(/\.md$/i, '')}
                    </button>
                    <button
                      type="button"
                      aria-label={`Cerrar ${tab}`}
                      onClick={() => void requestClose(pane.id, tab)}
                      className="text-ink-faint hover:text-ink pr-1.5 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {pane.tabs.length === 0 && (
                  <span className="text-ink-muted px-2 py-1.5 text-xs">Sin notas abiertas</span>
                )}
              </div>

              <div className="min-h-0 flex-1">
                {pane.activeTab ? (
                  /* The page is FULL BLEED inside its pane — no floating card,
                     no drop shadow, no centred max-width. A sheet of paper in a
                     notebook is flush with the binding; the only separation it
                     needs from the chrome is the hairline the pane already
                     draws. Centring the page here is what produced the dead
                     gutters on either side of the note. */
                  <div className="bg-paper-elevated flex h-full min-h-0 w-full flex-col overflow-hidden">
                    {/* The masthead aligns to the text inset, not to an
                        arbitrary px-4: the label, the first character of every
                        ruled line and the filename below share one axis. */}
                    <div className="border-rule-soft flex items-center justify-between gap-3 border-b px-4 py-2 md:pr-[var(--rule-gutter)] md:pl-[var(--rule-text-inset)]">
                      <div className="min-w-0" title={pane.activeTab}>
                        <p className="text-2xs text-ink-muted tracking-[0.18em] uppercase">
                          Notas
                        </p>
                        <h2 className="text-ink truncate font-serif text-lg font-semibold">
                          {(pane.activeTab.split('/').pop() ?? pane.activeTab).replace(
                            /\.md$/,
                            '',
                          )}
                        </h2>
                      </div>
                    </div>
                    {/* The ruling itself lives in the editor theme, painted on
                        the scroller — see editor-theme.ts. Painting it here,
                        on a box the text scrolled inside, meant the lines and
                        the words agreed only at scroll position zero. */}
                    <div className="min-h-0 flex-1">
                      <NoteEditor
                        // Key per pane+path: two panes showing the same note are
                        // two editors, each with its own conflict state.
                        key={`${pane.id}:${pane.activeTab}`}
                        path={pane.activeTab}
                        onWikilink={onWikilink}
                        wikilinkTargets={wikilinkTargets}
                        onSaved={handleSaved}
                        registerEditor={guard.register}
                        onClose={() => void requestClose(pane.id, pane.activeTab!)}
                      />
                    </div>
                    <BacklinksPanel path={pane.activeTab} onOpen={open} />
                  </div>
                ) : (
                  <EmptyPane
                    sidebarOpen={sidebarOpen}
                    vaultIsEmpty={!knowledge.building && knowledge.index.notes().length === 0}
                    onOpenSidebar={() => setSidebarOpen(true)}
                    onCreateFirst={() => {
                      setSidebarOpen(true)
                      setCreateRequest((n) => n + 1)
                    }}
                  />
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function EmptyPane({
  sidebarOpen,
  vaultIsEmpty,
  onOpenSidebar,
  onCreateFirst,
}: {
  sidebarOpen: boolean
  vaultIsEmpty: boolean
  onOpenSidebar: () => void
  onCreateFirst: () => void
}) {
  // ONE message, and its one action always does something: an empty vault is
  // offered its first note; otherwise the explorer button only shows when the
  // explorer is actually hidden (on desktop it sits right beside this).
  const action = vaultIsEmpty ? (
    <Button variant="secondary" size="sm" onClick={onCreateFirst}>
      Escribir mi primera nota
    </Button>
  ) : !sidebarOpen ? (
    <Button variant="secondary" size="sm" onClick={onOpenSidebar}>
      Abrir el explorador
    </Button>
  ) : undefined

  return (
    <div className="grid h-full place-items-center p-6">
      <EmptyState
        quiet
        icon={FileText}
        title={
          vaultIsEmpty
            ? 'Todavía no escribiste ninguna nota.'
            : 'Ninguna nota abierta en este panel.'
        }
        action={action}
      />
    </div>
  )
}
