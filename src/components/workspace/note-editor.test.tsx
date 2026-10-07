import { act, fireEvent, render, screen } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FilesProvider } from '@/lib/files/context'

import { FakeDisk } from '../../../tests/support/fake-disk'

import { NoteEditor, type EditorHandle } from './note-editor'

/**
 * The editor as a student meets it: the real CodeMirror view, the real footer,
 * a vault with controllable latency. The state machine has its own tests
 * (`lib/workspace/autosave.test.ts`); these prove the editor is wired to it.
 */

// jsdom has no layout, and CodeMirror measures text through Range geometry.
beforeEach(() => {
  vi.useFakeTimers()
  const empty = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  })
  Range.prototype.getBoundingClientRect = (() => empty()) as never
  Range.prototype.getClientRects = (() => [] as unknown as DOMRectList) as never
})
afterEach(() => vi.useRealTimers())

function mount(disk: FakeDisk, props: Partial<Parameters<typeof NoteEditor>[0]> = {}) {
  return render(
    <FilesProvider access={disk.access()}>
      <NoteEditor path="n.md" {...props} />
    </FilesProvider>,
  )
}

const viewOf = () => {
  const dom = document.querySelector<HTMLElement>('.cm-editor')
  const view = dom ? EditorView.findFromDOM(dom) : null
  if (!view) throw new Error('editor not mounted')
  return view
}

const append = (text: string) => {
  const view = viewOf()
  act(() => {
    view.dispatch({ changes: { from: view.state.doc.length, insert: text } })
  })
}

const settle = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

async function open(disk: FakeDisk, props?: Parameters<typeof mount>[1]) {
  const view = mount(disk, props)
  await settle(0)
  return view
}

describe('autosave in the editor', () => {
  it('shows Guardado only when the editor holds what is on disk (DEV-01)', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'AAA')
    await open(disk)
    disk.latency = 300

    append('XXX')
    await settle(950) // the first autosave is in flight
    append('YYY')
    await settle(3000)

    expect(viewOf().state.doc.toString()).toBe('AAAXXXYYY')
    expect(disk.contents('n.md')).toBe('AAAXXXYYY')
    expect(screen.getByText('Guardado')).toBeInTheDocument()
  })

  it('does not raise a false conflict when a save outlasts the debounce', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'AAA')
    await open(disk)
    disk.latency = 1500

    append('XXX')
    await settle(950)
    append('YYY')
    await settle(8000)

    expect(screen.queryByText('Este archivo cambió fuera de Campus.')).toBeNull()
    expect(disk.contents('n.md')).toBe('AAAXXXYYY')
  })

  it('saves edits typed a moment before the editor is closed (DEV-02)', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'AAA')
    const { unmount } = await open(disk)

    append('LOSTLOST')
    await settle(300)
    unmount()
    await settle(1000)

    expect(disk.contents('n.md')).toBe('AAALOSTLOST')
  })

  it('exposes a handle so the workspace can flush before closing a tab', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'AAA')
    let handle: EditorHandle | null = null
    await open(disk, {
      registerEditor: (h) => {
        handle = h
        return () => {
          handle = null
        }
      },
    })

    append('typed')
    expect(handle!.unsaved()).toBe(true)
    await act(async () => {
      await handle!.flush()
    })
    expect(disk.contents('n.md')).toBe('AAAtyped')
    expect(handle!.unsaved()).toBe(false)
  })

  it('does not rewrite a note it only reloaded after an external change (DEV-06)', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'AAA')
    await open(disk)

    disk.externalWrite('n.md', 'AAA\nexternal')
    const mtime = disk.files.get('n.md')!.mtimeMs
    await settle(12_000)

    expect(viewOf().state.doc.toString()).toBe('AAA\nexternal')
    expect(disk.writes).toEqual([])
    expect(disk.files.get('n.md')!.mtimeMs).toBe(mtime)
  })
})

describe('recovery from a changed or moved file (DEV-05)', () => {
  it('says the note was moved or deleted, and offers Guardar como nueva and Cerrar', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'AAA')
    const onClose = vi.fn()
    await open(disk, { onClose })

    disk.externalDelete('n.md')
    append('mine')
    await settle(1000)

    expect(screen.getByText('Esta nota se movió o se eliminó.')).toBeInTheDocument()
    expect(screen.queryByText('Este archivo cambió fuera de Campus.')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar como nueva' }))
    await settle(100)
    expect(disk.contents('n.md')).toBe('AAAmine')
    expect(screen.getByText('Guardado')).toBeInTheDocument()
  })

  it('Cerrar asks the workspace to close the tab', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'AAA')
    const onClose = vi.fn()
    await open(disk, { onClose })
    disk.externalDelete('n.md')
    append('mine')
    await settle(1000)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Conservar mi versión on a deleted file shows a Spanish message and no stuck "Sin guardar"', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'AAA')
    await open(disk)
    append('mine')
    disk.externalWrite('n.md', 'theirs')
    await settle(6000)
    expect(screen.getByText('Este archivo cambió fuera de Campus.')).toBeInTheDocument()

    disk.externalDelete('n.md')
    fireEvent.click(screen.getByRole('button', { name: 'Conservar mi versión' }))
    await settle(100)

    expect(screen.getByText('Esta nota se movió o se eliminó.')).toBeInTheDocument()
    expect(screen.queryByText('Sin guardar')).toBeNull()
  })

  it('shows a Spanish reason, never the raw error, when a note cannot be opened', async () => {
    const disk = new FakeDisk()
    await open(disk) // n.md does not exist
    expect(screen.getByText('No pudimos abrir esta nota.')).toBeInTheDocument()
    expect(
      screen.getByText('Eso ya no está en el Vault: se movió o se eliminó.'),
    ).toBeInTheDocument()
  })
})

describe('the editor is usable without sight (DIS-12)', () => {
  it('has an accessible name and a placeholder', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', '')
    await open(disk)

    expect(screen.getByRole('textbox', { name: 'Contenido de la nota' })).toBeInTheDocument()
    expect(document.querySelector('.cm-placeholder')).not.toBeNull()
  })

  it('shows the file name once: not repeated in the footer', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'x')
    await open(disk)
    expect(screen.queryByText('n.md')).toBeNull()
  })
})
