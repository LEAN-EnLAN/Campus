import { describe, expect, it } from 'vitest'

import { VaultIndex } from '@/lib/knowledge/vault-index'

import { closePath, emptyWorkspace, openNote, renamePath } from './model'

/**
 * Renaming or trashing a FOLDER moves every note inside it (DEV-05). The model
 * used to match exact paths only, so a tab for `carp/n.md` kept pointing at a
 * folder that no longer existed.
 */

const withTabs = (...paths: string[]) =>
  paths.reduce((s, p) => openNote(s, p), emptyWorkspace())

describe('renamePath on a folder', () => {
  it('moves every tab inside it, and the active tab', () => {
    const state = withTabs('carp/n.md', 'carp/sub/m.md', 'other.md', 'carp/z.md')
    const next = renamePath(state, 'carp', 'carp2')
    const pane = next.panes[0]!
    expect(pane.tabs).toEqual(['carp2/n.md', 'carp2/sub/m.md', 'other.md', 'carp2/z.md'])
    expect(pane.activeTab).toBe('carp2/z.md')
  })

  it('does not touch a sibling that merely shares the prefix', () => {
    const state = withTabs('carpeta/n.md', 'carp.md')
    const next = renamePath(state, 'carp', 'carp2')
    expect(next.panes[0]!.tabs).toEqual(['carpeta/n.md', 'carp.md'])
  })

  it('still renames a single file by exact path', () => {
    const next = renamePath(withTabs('a.md'), 'a.md', 'b.md')
    expect(next.panes[0]!.tabs).toEqual(['b.md'])
  })
})

describe('closePath on a folder', () => {
  it('closes every tab inside the trashed folder and nothing else', () => {
    const state = withTabs('carp/n.md', 'carp/sub/m.md', 'carpeta/x.md', 'other.md')
    const next = closePath(state, 'carp')
    expect(next.panes[0]!.tabs).toEqual(['carpeta/x.md', 'other.md'])
  })
})

describe('the link index follows a folder', () => {
  const build = () => {
    const index = new VaultIndex()
    index.upsert('carp/n.md', '# N\n\nsee [[Otra]]')
    index.upsert('carp/sub/m.md', '# M')
    index.upsert('carpeta/x.md', '# X')
    index.upsert('Otra.md', '# Otra\n\n[[N]]')
    return index
  }

  it('renames every note inside the folder', () => {
    const index = build()
    index.rename('carp', 'carp2')
    expect(index.get('carp2/n.md')).not.toBeNull()
    expect(index.get('carp2/sub/m.md')).not.toBeNull()
    expect(index.get('carp/n.md')).toBeNull()
    expect(index.get('carpeta/x.md')).not.toBeNull()
    // Backlinks and resolution use the new paths.
    expect(index.resolve('N')).toEqual({ status: 'resolved', path: 'carp2/n.md' })
    expect(index.backlinks('carp2/n.md').map((b) => b.sourcePath)).toEqual(['Otra.md'])
  })

  it('removes every note inside a trashed folder', () => {
    const index = build()
    index.remove('carp')
    expect(index.notes().map((n) => n.path)).toEqual(['Otra.md', 'carpeta/x.md'])
  })
})
