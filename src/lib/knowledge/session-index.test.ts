import { describe, expect, it } from 'vitest'

import { FakeDisk } from '../../../tests/support/fake-disk'

import { ensureSessionIndex, sessionFor, syncSessionIndex } from './session-index'

/**
 * One note index per session, shared by the workspace and global search.
 *
 * The cost that mattered: every visit to /vault re-read every note, one
 * request at a time (DEV-17). Now a note is read when it is new or its mtime
 * moved, and never otherwise.
 */

function vaultOf(count: number) {
  const disk = new FakeDisk()
  for (let i = 0; i < count; i += 1) disk.put(`carpeta-${i % 5}/nota-${i}.md`, `# Nota ${i}\n`)
  disk.put('raiz.md', '# Raíz')
  disk.put('image.png', 'binary')
  return disk
}

describe('the session index', () => {
  it('reads every note once on first use, and only notes', async () => {
    const disk = vaultOf(20)
    const files = disk.access()
    await ensureSessionIndex(files)
    expect(disk.reads.length).toBe(21)
    expect(disk.reads).not.toContain('image.png')
    expect(sessionFor(files).index.notes()).toHaveLength(21)
  })

  it('re-entering issues no per-note requests when nothing changed', async () => {
    const disk = vaultOf(50)
    const files = disk.access()
    await ensureSessionIndex(files)
    disk.reads.length = 0

    await ensureSessionIndex(files)
    await syncSessionIndex(files)
    expect(disk.reads).toEqual([])
  })

  it('a sync reads only the notes that changed, are new, or vanished', async () => {
    const disk = vaultOf(10)
    const files = disk.access()
    await ensureSessionIndex(files)
    disk.reads.length = 0

    disk.externalWrite('carpeta-0/nota-0.md', '# Cambiada\n')
    disk.put('nueva.md', '# Nueva\n')
    disk.externalDelete('carpeta-1/nota-1.md')
    await syncSessionIndex(files)

    expect(disk.reads.sort()).toEqual(['carpeta-0/nota-0.md', 'nueva.md'])
    const index = sessionFor(files).index
    expect(index.get('carpeta-0/nota-0.md')?.title).toBe('Cambiada')
    expect(index.get('nueva.md')).not.toBeNull()
    expect(index.get('carpeta-1/nota-1.md')).toBeNull()
  })

  it('concurrent first uses share one scan', async () => {
    const disk = vaultOf(10)
    const files = disk.access()
    await Promise.all([ensureSessionIndex(files), ensureSessionIndex(files)])
    expect(disk.reads.length).toBe(11)
  })

  it('keeps what it knew about a folder it could not list this time', async () => {
    const disk = vaultOf(10)
    const files = disk.access()
    await ensureSessionIndex(files)
    const flaky = {
      ...files,
      listDir: async (dir: string) => {
        if (dir === 'carpeta-0') throw new Error('boom')
        return files.listDir(dir)
      },
    }
    // Same session: the index is keyed by the capability object.
    const session = sessionFor(files)
    await syncSessionIndex(flaky, session)
    expect(session.index.get('carpeta-0/nota-0.md')).not.toBeNull()
  })

  it('follows a rename and a trash without re-reading', async () => {
    const disk = vaultOf(10)
    const files = disk.access()
    await ensureSessionIndex(files)
    const session = sessionFor(files)

    session.renamed('carpeta-0', 'moved')
    session.index.rename('carpeta-0', 'moved')
    disk.reads.length = 0
    // The disk moved too, with the same mtimes.
    for (const path of [...disk.files.keys()]) {
      if (path.startsWith('carpeta-0/')) {
        const file = disk.files.get(path)!
        disk.files.delete(path)
        disk.files.set('moved/' + path.slice('carpeta-0/'.length), file)
      }
    }
    await syncSessionIndex(files)
    expect(disk.reads).toEqual([])
  })

  it('different vaults never share an index', async () => {
    const a = vaultOf(2).access()
    const b = vaultOf(3).access()
    await ensureSessionIndex(a)
    await ensureSessionIndex(b)
    expect(sessionFor(a).index.notes()).toHaveLength(3)
    expect(sessionFor(b).index.notes()).toHaveLength(4)
  })
})
