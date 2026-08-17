import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import { KnowledgeProvider, useKnowledge } from '@/lib/knowledge/provider'

import { BacklinksPanel } from './backlinks-panel'
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

export function WorkspaceShell({ vaultKey }: { vaultKey: string }) {
  return (
    <KnowledgeProvider>
      <WorkspaceShellInner vaultKey={vaultKey} />
    </KnowledgeProvider>
  )
}

function WorkspaceShellInner({ vaultKey }: { vaultKey: string }) {
  const storageKey = workspaceStorageKey(vaultKey)
  const [state, setState] = useState<WorkspaceState>(() =>
    deserialize(localStorage.getItem(storageKey)),
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const files = useFiles()
  const knowledge = useKnowledge()

  // Persist on every change, debounced by the event loop — layout writes are
  // tiny and losing one to a crash costs nothing.
  useEffect(() => {
    localStorage.setItem(storageKey, serialize(state))
  }, [state, storageKey])

  const active = state.panes.find((p) => p.id === state.activePaneId) ?? state.panes[0]!
  const activePath = active.activeTab

  const open = useCallback(
    (path: string) => {
      setState((s) => openNote(s, path))
      knowledge.noteOpened(path)
    },
    [knowledge],
  )

  const openRef = useRef(open)
  openRef.current = open
  const knowledgeRef = useRef(knowledge)
  knowledgeRef.current = knowledge
  const filesRef = useRef(files)
  filesRef.current = files

  // "Nota de hoy": Daily/YYYY-MM-DD.md, created from a tiny template on first
  // use, just opened afterwards. The date is built from LOCAL components —
  // Argentina is UTC-3 and toISOString() would file tonight's note under
  // tomorrow.
  const openDailyNote = useCallback(async () => {
    const files = filesRef.current
    if (!files) return
    const now = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const path = `Daily/${stamp}.md`
    const existing = await files.stat(path).catch(() => null)
    if (!existing) {
      const body = `---\ndate: ${stamp}\ntype: daily\n---\n\n# ${stamp}\n\n- [ ] \n`
      await files.writeNote(path, body, null).catch(() => {})
      knowledgeRef.current.noteCreated(path, body)
    }
    openRef.current(path)
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
    } else if (verdict.status === 'missing') {
      const path = target.endsWith('.md') ? target : `${target}.md`
      void filesRef.current
        ?.writeNote(path, `# ${target}\n\n`, null)
        .then(() => {
          knowledgeRef.current.noteCreated(path, `# ${target}\n\n`)
          openRef.current(path)
        })
        .catch(() => {
          // The vault refused the name (invalid, or created meanwhile). The
          // student sees nothing happen rather than a wrong note opening.
        })
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
      closeActive: () =>
        setState((s) => {
          const pane = s.panes.find((p) => p.id === s.activePaneId)
          return pane?.activeTab ? closeTab(s, pane.id, pane.activeTab) : s
        }),
      toggleSidebar: () => setSidebarOpen((v) => !v),
    }),
    [],
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
            aria-label="Explorador del Vault"
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
              onOpen={(p) => (open(p), setSidebarOpen(window.innerWidth >= 768))}
              onRenamed={handleRenamed}
              onTrashed={handleTrashed}
            />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1">
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
              } ${isActivePane && state.panes.length > 1 ? 'bg-paper' : ''}`}
            >
              <div
                role="tablist"
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
                      role="tab"
                      aria-selected={pane.activeTab === tab}
                      onClick={() =>
                        setState((s) => activateTab(activatePane(s, pane.id), pane.id, tab))
                      }
                      className="max-w-44 truncate px-2.5 py-1.5 text-xs"
                      title={tab}
                    >
                      {(tab.split('/').pop() ?? tab).replace(/\.md$/, '')}
                    </button>
                    <button
                      type="button"
                      aria-label={`Cerrar ${tab}`}
                      onClick={() => setState((s) => closeTab(s, pane.id, tab))}
                      className="text-ink-faint hover:text-ink pr-1.5 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {pane.tabs.length === 0 && (
                  <span className="text-ink-faint px-2 py-1.5 text-xs">Sin notas abiertas</span>
                )}
              </div>

              <div className="min-h-0 flex-1">
                {pane.activeTab ? (
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="min-h-0 flex-1">
                      <NoteEditor
                        // Key per pane+path: two panes showing the same note are
                        // two editors, each with its own conflict state.
                        key={`${pane.id}:${pane.activeTab}`}
                        path={pane.activeTab}
                        onWikilink={onWikilink}
                        wikilinkTargets={wikilinkTargets}
                        onSaved={handleSaved}
                      />
                    </div>
                    <BacklinksPanel path={pane.activeTab} onOpen={open} />
                  </div>
                ) : (
                  <EmptyPane onOpenSidebar={() => setSidebarOpen(true)} />
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function EmptyPane({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="text-center">
        {/* Editorial line-art placeholder: a blank index card. Decorative. */}
        <svg
          aria-hidden
          viewBox="0 0 96 64"
          className="text-ink-faint mx-auto mb-3 h-16 w-24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="6" y="8" width="84" height="48" rx="3" />
          <line x1="14" y1="22" x2="82" y2="22" />
          <line x1="14" y1="32" x2="66" y2="32" strokeDasharray="2 3" />
          <line x1="14" y1="40" x2="74" y2="40" strokeDasharray="2 3" />
        </svg>
        <p className="text-ink-muted text-sm">Ninguna nota abierta en este panel.</p>
        <button
          type="button"
          onClick={onOpenSidebar}
          className="border-rule text-ink mt-2 rounded-md border px-3 py-1 text-sm"
        >
          Abrir el explorador
        </button>
      </div>
    </div>
  )
}
