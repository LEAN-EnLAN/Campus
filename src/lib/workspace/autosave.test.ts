import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { VaultError } from '@/lib/vault/errors'

import { FakeDisk } from '../../../tests/support/fake-disk'

import { NoteAutosave, type SaveState } from './autosave'

/**
 * The autosave state machine, without an editor in the way.
 *
 * Every test here is a way the old loop told the student "Guardado" while the
 * text on disk was something else.
 */

/** A stand-in for CodeMirror: just a mutable string. */
function setup(initial = 'AAA', path = 'n.md') {
  const disk = new FakeDisk()
  disk.put(path, initial)
  const host = { text: '' }
  const states: SaveState[] = []
  const saved: string[] = []
  const hooks: { onState?: () => void } = {}
  const autosave = new NoteAutosave({
    files: disk.access(),
    path,
    host: {
      readText: () => host.text,
      replaceText: (text) => {
        host.text = text
        // The editor reports EVERY document change, including this one.
        autosave.edited()
      },
    },
    onState: (state) => {
      states.push(state)
      hooks.onState?.()
    },
    onSaved: (_, contents) => saved.push(contents),
  })
  const type = (suffix: string) => {
    host.text += suffix
    autosave.edited()
  }
  return { disk, host, states, saved, autosave, type, path, hooks }
}

const last = (states: SaveState[]) => states[states.length - 1]?.kind

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('loading', () => {
  it('shows the file and is saved', async () => {
    const { autosave, host } = setup()
    await autosave.load()
    expect(host.text).toBe('AAA')
    expect(autosave.state.kind).toBe('saved')
  })
})

describe('typing while a save is in flight (DEV-01)', () => {
  it('saves the later characters with a follow-up save, and only then says Guardado', async () => {
    const { disk, host, autosave, type } = setup()
    await autosave.load()
    disk.latency = 300

    type('XXX')
    await vi.advanceTimersByTimeAsync(800) // autosave fires, write is in flight
    expect(autosave.state.kind).toBe('saving')
    type('YYY') // typed while the first write is still in the air
    expect(autosave.state.kind).not.toBe('saved')

    await vi.advanceTimersByTimeAsync(3000)
    expect(host.text).toBe('AAAXXXYYY')
    expect(disk.contents('n.md')).toBe('AAAXXXYYY')
    expect(autosave.state.kind).toBe('saved')
  })

  it('does not report a false conflict when the second timer fires during a slow save', async () => {
    const { disk, host, states, autosave, type } = setup()
    await autosave.load()
    disk.latency = 1500

    type('XXX')
    await vi.advanceTimersByTimeAsync(800)
    type('YYY')
    await vi.advanceTimersByTimeAsync(800) // second timer fires, first save still in flight
    await vi.advanceTimersByTimeAsync(6000)

    expect(states.map((s) => s.kind)).not.toContain('conflict')
    expect(disk.contents('n.md')).toBe(host.text)
    expect(host.text).toBe('AAAXXXYYY')
    expect(autosave.state.kind).toBe('saved')
  })

  it('never says saved while the editor text differs from the disk', async () => {
    const { disk, host, states, autosave, type, hooks } = setup()
    await autosave.load()
    disk.latency = 200
    // Every state change is checked against reality at the moment it happens.
    const check = () => {
      if (autosave.state.kind === 'saved') expect(disk.contents('n.md')).toBe(host.text)
    }
    hooks.onState = check

    for (const chunk of ['a', 'b', 'c', 'd']) {
      type(chunk)
      await vi.advanceTimersByTimeAsync(700)
    }
    await vi.advanceTimersByTimeAsync(5000)
    expect(last(states)).toBe('saved')
    expect(disk.contents('n.md')).toBe(host.text)
  })
})

describe('leaving with pending edits (DEV-02)', () => {
  it('flush() saves the edits typed a moment ago', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    type('LOST')
    await autosave.flush()
    expect(disk.contents('n.md')).toBe('AAALOST')
    expect(autosave.unsaved()).toBe(false)
  })

  it('flush() waits for a save already in flight and then saves what came after', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    disk.latency = 300
    type('1')
    await vi.advanceTimersByTimeAsync(800)
    type('2')
    const flushed = autosave.flush()
    await vi.advanceTimersByTimeAsync(2000)
    await flushed
    expect(disk.contents('n.md')).toBe('AAA12')
  })

  it('disposing with edits still saves them even though the editor is gone', async () => {
    const { disk, host, autosave, type } = setup()
    await autosave.load()
    type('BYE')
    autosave.disposeAndFlush()
    host.text = '' // the view was destroyed
    await vi.advanceTimersByTimeAsync(1000)
    expect(disk.contents('n.md')).toBe('AAABYE')
  })

  it('flush() leaves unsaved() true when the save fails, so the caller can warn', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    disk.failNextWith = new VaultError('io_error')
    type('X')
    await autosave.flush()
    expect(autosave.unsaved()).toBe(true)
    expect(autosave.state.kind).toBe('error')
  })

  it('flush() on a conflict does not overwrite the other version', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    type('mine')
    disk.externalWrite('n.md', 'theirs')
    await autosave.flush()
    expect(autosave.state.kind).toBe('conflict')
    expect(autosave.unsaved()).toBe(true)
    expect(disk.contents('n.md')).toBe('theirs')
  })
})

describe('an external change to a note you did not edit (DEV-06)', () => {
  it('reloads it and does NOT write the file back', async () => {
    const { disk, host, autosave } = setup()
    await autosave.load()
    disk.externalWrite('n.md', 'AAA\nexternal')
    const before = disk.files.get('n.md')!.mtimeMs

    await autosave.checkExternal()
    await vi.advanceTimersByTimeAsync(5000)

    expect(host.text).toBe('AAA\nexternal')
    expect(disk.writes).toEqual([])
    expect(disk.files.get('n.md')!.mtimeMs).toBe(before)
    expect(autosave.state.kind).toBe('saved')
  })

  it('is a conflict, not a silent overwrite, when the student typed during the read', async () => {
    const { disk, host, autosave, type } = setup()
    await autosave.load()
    disk.externalWrite('n.md', 'AAA!')
    const check = autosave.checkExternal()
    type('typed')
    await check
    expect(autosave.state.kind).toBe('conflict')
    expect(host.text).toBe('AAAtyped')
  })

  it('is a conflict when the student holds unsaved edits', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    type('mine')
    disk.externalWrite('n.md', 'theirs')
    await autosave.checkExternal()
    expect(autosave.state.kind).toBe('conflict')
  })
})

describe('conflict resolution never fails silently (DEV-05)', () => {
  it('"Conservar mi versión" saves over the disk version', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    type('mine')
    disk.externalWrite('n.md', 'theirs')
    await autosave.checkExternal()

    await autosave.keepMine()
    expect(disk.contents('n.md')).toBe('AAAmine')
    expect(autosave.state.kind).toBe('saved')
  })

  it('"Conservar mi versión" on a file that is gone says so, and does not stick at Sin guardar', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    type('mine')
    disk.externalWrite('n.md', 'theirs')
    await autosave.checkExternal()
    disk.externalDelete('n.md')

    await expect(autosave.keepMine()).resolves.toBeUndefined()
    expect(autosave.state.kind).toBe('missing')
  })

  it('"Recargar del disco" on a file that is gone says so', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    type('mine')
    disk.externalDelete('n.md')
    await expect(autosave.reload()).resolves.toBeUndefined()
    expect(autosave.state.kind).toBe('missing')
  })

  it('typing into a note that was moved shows missing instead of a false "changed"', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    disk.externalDelete('n.md') // e.g. its folder was renamed
    type('more')
    await vi.advanceTimersByTimeAsync(1000)
    expect(autosave.state.kind).toBe('missing')
  })

  it('"Guardar como nueva" recreates the file with the editor text', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    disk.externalDelete('n.md')
    type('rescued')
    await vi.advanceTimersByTimeAsync(1000)
    expect(autosave.state.kind).toBe('missing')

    await autosave.saveAsNew()
    expect(disk.contents('n.md')).toBe('AAArescued')
    expect(autosave.state.kind).toBe('saved')
  })

  it('an unexpected failure while resolving becomes an error state with a Spanish message', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    type('mine')
    disk.externalWrite('n.md', 'theirs')
    await autosave.checkExternal()
    disk.failNextWith = new Error("EACCES: permission denied, open '/home/x/n.md'")

    await autosave.keepMine()
    expect(autosave.state.kind).toBe('error')
    const state = autosave.state as Extract<SaveState, { kind: 'error' }>
    expect(state.message).not.toMatch(/EACCES|\/home/)
  })
})

describe('errors', () => {
  it('a failed save shows a Spanish reason and the next edit tries again', async () => {
    const { disk, autosave, type } = setup()
    await autosave.load()
    disk.failNextWith = new VaultError('name_reserved')
    type('a')
    await vi.advanceTimersByTimeAsync(1000)
    expect(autosave.state.kind).toBe('error')
    expect((autosave.state as { message: string }).message).toBe(
      'Ese nombre está reservado por Windows.',
    )

    type('b')
    await vi.advanceTimersByTimeAsync(1000)
    expect(disk.contents('n.md')).toBe('AAAab')
    expect(autosave.state.kind).toBe('saved')
  })

  it('undoing back to the saved text is saved, with no write', async () => {
    const { disk, host, autosave, type } = setup()
    await autosave.load()
    type('x')
    host.text = 'AAA'
    autosave.edited()
    await vi.advanceTimersByTimeAsync(2000)
    expect(disk.writes).toEqual([])
    expect(autosave.state.kind).toBe('saved')
  })
})
