/**
 * Workspace layout: which notes are open, in which pane, and what is focused.
 * A pure reducer — every action takes a state and returns a NEW state — so the
 * React layer stays a thin dispatcher and every layout rule is testable
 * without rendering anything.
 *
 * Layout is DEVICE-local and per-vault, never vault data. `docs/vault-format.md`
 * draws the same line `device-config.ts` does: window layout on a synced vault
 * would push one machine's open tabs onto another. So this serializes into the
 * browser's own storage under a per-vault key, and nothing here ever touches
 * `.campus/`.
 */

export interface Pane {
  readonly id: string
  /** Vault-relative note paths, in tab-strip order. */
  readonly tabs: string[]
  readonly activeTab: string | null
}

export interface WorkspaceState {
  readonly panes: Pane[]
  readonly activePaneId: string
}

/**
 * Two panes, hard cap (v1). One comparison view — reading the source while
 * writing the summary — covers the real study workflow; N panes covers a
 * tiling window manager, which the OS already provides.
 */
const MAX_PANES = 2

/**
 * Deterministic ids beat generated ones at a cap of two: serialization stays
 * byte-stable across sessions and tests never depend on a counter.
 */
const PANE_IDS = ['pane-1', 'pane-2'] as const

export function emptyWorkspace(): WorkspaceState {
  return {
    panes: [{ id: PANE_IDS[0], tabs: [], activeTab: null }],
    activePaneId: PANE_IDS[0],
  }
}

function findPane(state: WorkspaceState, paneId: string): Pane | undefined {
  return state.panes.find((p) => p.id === paneId)
}

function replacePane(state: WorkspaceState, pane: Pane): WorkspaceState {
  return { ...state, panes: state.panes.map((p) => (p.id === pane.id ? pane : p)) }
}

export interface OpenNoteOptions {
  /** Target pane. Defaults to the active pane. */
  paneId?: string
  /** Open without stealing focus — for "open in background" affordances. */
  background?: boolean
}

/**
 * Open a note in the target pane. Already open THERE means activate, not
 * duplicate — a tab strip with the same note twice is two tabs fighting over
 * one file. The same path open in the OTHER pane is fine: two panes showing
 * the same note side by side is a legitimate reading mode.
 */
export function openNote(
  state: WorkspaceState,
  path: string,
  opts?: OpenNoteOptions,
): WorkspaceState {
  const paneId = opts?.paneId ?? state.activePaneId
  const pane = findPane(state, paneId)
  if (!pane) return state

  const alreadyOpen = pane.tabs.includes(path)
  if (alreadyOpen && opts?.background) return state

  const tabs = alreadyOpen ? pane.tabs : [...pane.tabs, path]
  if (opts?.background) {
    return replacePane(state, { ...pane, tabs })
  }
  return {
    ...replacePane(state, { ...pane, tabs, activeTab: path }),
    activePaneId: paneId,
  }
}

/**
 * Close one tab. If it was active, the nearest remaining neighbour takes over,
 * preferring the LEFT one — that is the tab the student was on before opening
 * this one, so focus falls "back" instead of jumping forward. A second pane
 * that loses its last tab disappears (an empty split is dead weight); the last
 * pane always survives, empty, because a workspace needs somewhere to open
 * the next note.
 */
export function closeTab(state: WorkspaceState, paneId: string, path: string): WorkspaceState {
  const pane = findPane(state, paneId)
  if (!pane) return state
  const index = pane.tabs.indexOf(path)
  if (index === -1) return state

  const tabs = pane.tabs.filter((t) => t !== path)

  if (tabs.length === 0 && state.panes.length > 1) {
    const panes = state.panes.filter((p) => p.id !== paneId)
    // Removing one of two panes always leaves one, but `noUncheckedIndexedAccess`
    // cannot prove it; degrading to empty is more honest than asserting.
    const survivor = panes[0]
    if (!survivor) return emptyWorkspace()
    return {
      panes,
      activePaneId: state.activePaneId === paneId ? survivor.id : state.activePaneId,
    }
  }

  const activeTab =
    pane.activeTab === path ? (tabs[index - 1] ?? tabs[index] ?? null) : pane.activeTab
  return replacePane(state, { ...pane, tabs, activeTab })
}

export function activateTab(
  state: WorkspaceState,
  paneId: string,
  path: string,
): WorkspaceState {
  const pane = findPane(state, paneId)
  // Activating a tab that is not there would invent state; refuse quietly.
  if (!pane || !pane.tabs.includes(path)) return state
  return replacePane(state, { ...pane, activeTab: path })
}

export function activatePane(state: WorkspaceState, paneId: string): WorkspaceState {
  if (!findPane(state, paneId)) return state
  return { ...state, activePaneId: paneId }
}

/**
 * Split: clone the active tab into a new second pane and focus it. Cloning
 * (rather than opening empty) is the point of splitting — "keep this visible
 * while I look at it from elsewhere". No-op at the cap.
 */
export function splitPane(state: WorkspaceState): WorkspaceState {
  if (state.panes.length >= MAX_PANES) return state
  const activeTab = findPane(state, state.activePaneId)?.activeTab ?? null
  const newId = state.panes.some((p) => p.id === PANE_IDS[0]) ? PANE_IDS[1] : PANE_IDS[0]
  const pane: Pane = {
    id: newId,
    tabs: activeTab ? [activeTab] : [],
    activeTab,
  }
  return { panes: [...state.panes, pane], activePaneId: newId }
}

export function closePane(state: WorkspaceState, paneId: string): WorkspaceState {
  // The only pane never closes: a workspace with zero panes has nowhere to
  // open anything, which is just a broken state with extra steps.
  if (state.panes.length <= 1) return state
  if (!findPane(state, paneId)) return state
  const panes = state.panes.filter((p) => p.id !== paneId)
  const survivor = panes[0]
  if (!survivor) return emptyWorkspace()
  return {
    panes,
    activePaneId: state.activePaneId === paneId ? survivor.id : state.activePaneId,
  }
}

/**
 * A vault rename must not orphan open tabs: the note the student is reading
 * did not close, it just changed address. Rewrites every occurrence in every
 * pane, tabs and activeTab alike.
 */
export function renamePath(state: WorkspaceState, from: string, to: string): WorkspaceState {
  return {
    ...state,
    panes: state.panes.map((pane) => ({
      ...pane,
      tabs: pane.tabs.map((t) => (t === from ? to : t)),
      activeTab: pane.activeTab === from ? to : pane.activeTab,
    })),
  }
}

/**
 * A trashed note closes EVERYWHERE — a tab pointing at a path that no longer
 * exists is a read error waiting for a click. Reuses `closeTab` so pane
 * removal and left-neighbour activation follow the exact same rules.
 */
export function closePath(state: WorkspaceState, path: string): WorkspaceState {
  // Snapshot the ids first: closeTab may remove a pane mid-iteration.
  const paneIds = state.panes.map((p) => p.id)
  let next = state
  for (const paneId of paneIds) {
    next = closeTab(next, paneId, path)
  }
  return next
}

export function serialize(state: WorkspaceState): string {
  return JSON.stringify(state)
}

/**
 * Restore a workspace from storage. NEVER throws: layout is rebuildable
 * convenience, so any corrupt, tampered, or unrecognizable payload degrades
 * to an empty workspace instead of blocking startup. Unknown fields are
 * dropped (we rebuild each object, we do not spread the parsed one), and the
 * two-pane cap is re-enforced — a payload claiming nine panes restores as two,
 * because storage is input, and input does not get to widen invariants.
 */
export function deserialize(raw: string | null): WorkspaceState {
  if (!raw) return emptyWorkspace()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyWorkspace()
  }
  if (typeof parsed !== 'object' || parsed === null) return emptyWorkspace()

  const candidate = parsed as { panes?: unknown; activePaneId?: unknown }
  if (!Array.isArray(candidate.panes)) return emptyWorkspace()

  const panes: Pane[] = []
  const seenIds = new Set<string>()
  for (const entry of candidate.panes) {
    if (panes.length >= MAX_PANES) break
    if (typeof entry !== 'object' || entry === null) continue
    const p = entry as { id?: unknown; tabs?: unknown; activeTab?: unknown }
    if (typeof p.id !== 'string' || p.id === '' || seenIds.has(p.id)) continue
    const tabs = Array.isArray(p.tabs)
      ? p.tabs.filter((t): t is string => typeof t === 'string')
      : []
    // activeTab must point at an open tab; anything else restores as null.
    const activeTab =
      typeof p.activeTab === 'string' && tabs.includes(p.activeTab) ? p.activeTab : null
    seenIds.add(p.id)
    panes.push({ id: p.id, tabs, activeTab })
  }
  const first = panes[0]
  if (!first) return emptyWorkspace()

  const activePaneId =
    typeof candidate.activePaneId === 'string' &&
    panes.some((p) => p.id === candidate.activePaneId)
      ? candidate.activePaneId
      : first.id

  return { panes, activePaneId }
}

/**
 * Storage key, namespaced per vault: two vaults must not share tab state, and
 * the layout lives in device storage — never inside the vault — for the same
 * reason `device-config.ts` keeps recent paths out of `.campus/`.
 */
export function workspaceStorageKey(vaultPath: string): string {
  return 'campus.workspace.v1:' + vaultPath
}
