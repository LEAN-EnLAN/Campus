import { describe, expect, it } from 'vitest'
import {
  activatePane,
  activateTab,
  closePane,
  closePath,
  closeTab,
  deserialize,
  emptyWorkspace,
  openNote,
  renamePath,
  serialize,
  splitPane,
  workspaceStorageKey,
  type WorkspaceState,
} from './model'

/** One pane with a.md, b.md, c.md open, b.md active. */
function threeTabs(): WorkspaceState {
  let s = emptyWorkspace()
  s = openNote(s, 'a.md')
  s = openNote(s, 'b.md')
  s = openNote(s, 'c.md')
  return activateTab(s, s.activePaneId, 'b.md')
}

/** Two panes: pane 1 holds ONLY a.md, pane 2 holds ONLY b.md (active, focused). */
function twoPanes(): WorkspaceState {
  let s = emptyWorkspace()
  s = openNote(s, 'a.md')
  s = splitPane(s) // pane 2 starts as a clone of a.md
  s = openNote(s, 'b.md')
  return closeTab(s, s.activePaneId, 'a.md') // leave pane 2 with just b.md
}

describe('emptyWorkspace', () => {
  it('starts with a single empty pane that is active', () => {
    const s = emptyWorkspace()
    expect(s.panes).toHaveLength(1)
    expect(s.panes[0]?.tabs).toEqual([])
    expect(s.panes[0]?.activeTab).toBeNull()
    expect(s.activePaneId).toBe(s.panes[0]?.id)
  })
})

describe('openNote', () => {
  it('opens in the active pane and activates the tab', () => {
    const s = openNote(emptyWorkspace(), 'a.md')
    expect(s.panes[0]?.tabs).toEqual(['a.md'])
    expect(s.panes[0]?.activeTab).toBe('a.md')
  })

  it('never mutates the input state', () => {
    const before = emptyWorkspace()
    openNote(before, 'a.md')
    expect(before.panes[0]?.tabs).toEqual([])
  })

  it('activates instead of duplicating when the note is already open in that pane', () => {
    let s = openNote(emptyWorkspace(), 'a.md')
    s = openNote(s, 'b.md')
    s = openNote(s, 'a.md')

    expect(s.panes[0]?.tabs).toEqual(['a.md', 'b.md'])
    expect(s.panes[0]?.activeTab).toBe('a.md')
  })

  it('opens in background without stealing tab focus or pane focus', () => {
    let s = openNote(emptyWorkspace(), 'a.md')
    s = openNote(s, 'b.md', { background: true })

    expect(s.panes[0]?.tabs).toEqual(['a.md', 'b.md'])
    expect(s.panes[0]?.activeTab).toBe('a.md')
  })

  it('allows the same note open in BOTH panes at once', () => {
    let s = twoPanes()
    // a.md already lives in pane 1; opening it in the focused pane 2 must not
    // be treated as "already open elsewhere".
    s = openNote(s, 'a.md')

    expect(s.panes[0]?.tabs).toContain('a.md')
    expect(s.panes[1]?.tabs).toContain('a.md')
  })

  it('targets an explicit paneId over the active pane', () => {
    const s = twoPanes()
    const other = s.panes.find((p) => p.id !== s.activePaneId)!
    const next = openNote(s, 'x.md', { paneId: other.id })

    expect(next.panes.find((p) => p.id === other.id)!.tabs).toContain('x.md')
    expect(next.activePaneId).toBe(other.id)
  })

  it('is a no-op for an unknown paneId', () => {
    const s = emptyWorkspace()
    expect(openNote(s, 'a.md', { paneId: 'nope' })).toBe(s)
  })
})

describe('closeTab', () => {
  it('closing the active tab activates the left neighbour', () => {
    const s = threeTabs()
    const next = closeTab(s, s.activePaneId, 'b.md')

    expect(next.panes[0]?.tabs).toEqual(['a.md', 'c.md'])
    expect(next.panes[0]?.activeTab).toBe('a.md')
  })

  it('closing the active FIRST tab falls forward to the right neighbour', () => {
    let s = threeTabs()
    s = activateTab(s, s.activePaneId, 'a.md')
    const next = closeTab(s, s.activePaneId, 'a.md')

    expect(next.panes[0]?.activeTab).toBe('b.md')
  })

  it('closing an inactive tab keeps the current active tab', () => {
    const s = threeTabs()
    const next = closeTab(s, s.activePaneId, 'c.md')

    expect(next.panes[0]?.activeTab).toBe('b.md')
  })

  it('closing the last tab of the second pane removes that pane', () => {
    const s = twoPanes()
    const next = closeTab(s, s.activePaneId, 'b.md')

    expect(next.panes).toHaveLength(1)
    expect(next.activePaneId).toBe(next.panes[0]?.id)
  })

  it('the last pane survives its last tab with activeTab null', () => {
    const s = openNote(emptyWorkspace(), 'a.md')
    const next = closeTab(s, s.activePaneId, 'a.md')

    expect(next.panes).toHaveLength(1)
    expect(next.panes[0]?.tabs).toEqual([])
    expect(next.panes[0]?.activeTab).toBeNull()
  })

  it('is a no-op when the path is not open in that pane', () => {
    const s = threeTabs()
    expect(closeTab(s, s.activePaneId, 'ghost.md')).toBe(s)
  })
})

describe('activateTab / activatePane', () => {
  it('activateTab switches the active tab within a pane', () => {
    const s = threeTabs()
    const next = activateTab(s, s.activePaneId, 'c.md')
    expect(next.panes[0]?.activeTab).toBe('c.md')
  })

  it('activateTab refuses a path that is not open in the pane', () => {
    const s = threeTabs()
    expect(activateTab(s, s.activePaneId, 'ghost.md')).toBe(s)
  })

  it('activatePane switches focus between panes', () => {
    const s = twoPanes()
    const other = s.panes.find((p) => p.id !== s.activePaneId)!
    expect(activatePane(s, other.id).activePaneId).toBe(other.id)
  })

  it('activatePane refuses an unknown pane', () => {
    const s = emptyWorkspace()
    expect(activatePane(s, 'nope')).toBe(s)
  })
})

describe('splitPane', () => {
  it('clones the active tab into a new second pane and focuses it', () => {
    const s = splitPane(openNote(emptyWorkspace(), 'a.md'))

    expect(s.panes).toHaveLength(2)
    expect(s.panes[1]?.tabs).toEqual(['a.md'])
    expect(s.panes[1]?.activeTab).toBe('a.md')
    expect(s.activePaneId).toBe(s.panes[1]?.id)
  })

  it('is a no-op at the two-pane cap', () => {
    const s = twoPanes()
    expect(splitPane(s)).toBe(s)
  })

  it('splitting an empty pane creates an empty second pane', () => {
    const s = splitPane(emptyWorkspace())
    expect(s.panes).toHaveLength(2)
    expect(s.panes[1]?.tabs).toEqual([])
  })
})

describe('closePane', () => {
  it('removes the pane and moves focus to the survivor', () => {
    const s = twoPanes()
    const next = closePane(s, s.activePaneId)

    expect(next.panes).toHaveLength(1)
    expect(next.activePaneId).toBe(next.panes[0]?.id)
  })

  it('is a no-op on the only pane', () => {
    const s = openNote(emptyWorkspace(), 'a.md')
    expect(closePane(s, s.activePaneId)).toBe(s)
  })
})

describe('renamePath', () => {
  it('rewrites tabs and activeTab so a vault rename does not orphan open tabs', () => {
    const s = threeTabs()
    const next = renamePath(s, 'b.md', 'renamed.md')

    expect(next.panes[0]?.tabs).toEqual(['a.md', 'renamed.md', 'c.md'])
    expect(next.panes[0]?.activeTab).toBe('renamed.md')
  })

  it('rewrites across both panes', () => {
    let s = twoPanes()
    s = openNote(s, 'a.md') // a.md now open in both panes
    const next = renamePath(s, 'a.md', 'moved/a.md')

    for (const pane of next.panes) {
      expect(pane.tabs).not.toContain('a.md')
      expect(pane.tabs).toContain('moved/a.md')
    }
  })
})

describe('closePath', () => {
  it('closes a trashed note in BOTH panes', () => {
    // Both panes keep a second tab so neither collapses when a.md goes.
    let s = emptyWorkspace()
    s = openNote(s, 'a.md')
    s = openNote(s, 'x.md')
    s = splitPane(s) // pane 2 clones x.md
    s = openNote(s, 'a.md') // pane 2: x.md + a.md

    const next = closePath(s, 'a.md')

    expect(next.panes).toHaveLength(2)
    for (const pane of next.panes) {
      expect(pane.tabs).not.toContain('a.md')
      expect(pane.tabs).toContain('x.md')
    }
  })

  it('drops the second pane when the closed path was its only tab', () => {
    const s = twoPanes() // pane 2 holds only b.md
    const next = closePath(s, 'b.md')

    expect(next.panes).toHaveLength(1)
  })
})

describe('serialize / deserialize', () => {
  it('round-trips a two-pane workspace exactly', () => {
    const s = twoPanes()
    expect(deserialize(serialize(s))).toEqual(s)
  })

  it('returns an empty workspace for null (nothing stored yet)', () => {
    expect(deserialize(null)).toEqual(emptyWorkspace())
  })

  it('never throws on corrupt JSON — returns an empty workspace', () => {
    expect(deserialize('{"panes": [oops')).toEqual(emptyWorkspace())
  })

  it('returns an empty workspace for valid JSON of the wrong shape', () => {
    expect(deserialize('42')).toEqual(emptyWorkspace())
    expect(deserialize('{"panes": "not-an-array"}')).toEqual(emptyWorkspace())
  })

  it('caps a tampered 9-pane payload at 2 panes', () => {
    const panes = Array.from({ length: 9 }, (_, i) => ({
      id: `pane-${i + 1}`,
      tabs: [`note-${i}.md`],
      activeTab: `note-${i}.md`,
    }))
    const restored = deserialize(JSON.stringify({ panes, activePaneId: 'pane-9' }))

    expect(restored.panes).toHaveLength(2)
    // The tampered activePaneId pointed at a dropped pane; focus falls back.
    expect(restored.activePaneId).toBe('pane-1')
  })

  it('drops unknown fields on restore', () => {
    const raw = JSON.stringify({
      panes: [{ id: 'pane-1', tabs: ['a.md'], activeTab: 'a.md', zoom: 3 }],
      activePaneId: 'pane-1',
      theme: 'dark',
    })
    const restored = deserialize(raw)

    // Exact key/shape equality: `theme` and `zoom` must not survive the trip.
    expect(Object.keys(restored).sort()).toEqual(['activePaneId', 'panes'])
    expect(restored.panes).toEqual([{ id: 'pane-1', tabs: ['a.md'], activeTab: 'a.md' }])
  })

  it('nulls an activeTab that does not point at an open tab', () => {
    const raw = JSON.stringify({
      panes: [{ id: 'pane-1', tabs: ['a.md'], activeTab: 'ghost.md' }],
      activePaneId: 'pane-1',
    })
    expect(deserialize(raw).panes[0]?.activeTab).toBeNull()
  })
})

describe('workspaceStorageKey', () => {
  it('namespaces per vault so two vaults never share tab state', () => {
    expect(workspaceStorageKey('/home/s/uni')).toBe('campus.workspace.v1:/home/s/uni')
    expect(workspaceStorageKey('/home/s/uni')).not.toBe(workspaceStorageKey('/home/s/other'))
  })
})
