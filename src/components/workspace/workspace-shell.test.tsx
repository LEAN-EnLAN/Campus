import { EditorView } from '@codemirror/view'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FilesProvider } from '@/lib/files/context'
import { VaultError } from '@/lib/vault/errors'

import { FakeDisk } from '../../../tests/support/fake-disk'

import { WorkspaceShell } from './workspace-shell'

/**
 * The workspace as a student drives it: explorer, tabs, editor, vault.
 * Each test is a gesture that used to lose text or fail without a word.
 */

beforeEach(() => {
  vi.useFakeTimers()
  // Newer Node ships its own `localStorage` global that shadows jsdom's.
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  })
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
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

async function mount(
  disk: FakeDisk,
  props: Partial<Parameters<typeof WorkspaceShell>[0]> = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <FilesProvider access={disk.access()}>
        <WorkspaceShell vaultKey={`/vault-${Math.random()}`} {...props} />
      </FilesProvider>
    </QueryClientProvider>,
  )
  await settle(50)
  return view
}

const viewOf = () => {
  const dom = document.querySelector<HTMLElement>('.cm-editor')
  const view = dom ? EditorView.findFromDOM(dom) : null
  if (!view) throw new Error('no editor open')
  return view
}
const append = (text: string) => {
  const view = viewOf()
  act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: text } }))
}
const click = async (name: string | RegExp) => {
  fireEvent.click(screen.getByRole('button', { name }))
  await settle(50)
}

describe('leaving a note with pending edits', () => {
  it('closing the tab saves what was typed a moment ago', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'AAA')
    await mount(disk)
    await click('n')
    append('LOSTLOST')
    await settle(300)

    await click('Cerrar n.md')

    expect(disk.contents('n.md')).toBe('AAALOSTLOST')
    expect(screen.queryByRole('button', { name: 'Cerrar n.md' })).toBeNull()
  })

  it('switching to another note saves the first one', async () => {
    const disk = new FakeDisk()
    disk.put('a.md', 'A')
    disk.put('b.md', 'B')
    await mount(disk)
    await click('a')
    append('1')
    await click('b')
    expect(disk.contents('a.md')).toBe('A1')
  })

  it('keeps the tab open when the text cannot be saved and the student says no', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'AAA')
    await mount(disk)
    await click('n')
    append('mine')
    disk.externalWrite('n.md', 'theirs')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await click('Cerrar n.md')

    expect(confirm).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cerrar n.md' })).toBeInTheDocument()
    expect(disk.contents('n.md')).toBe('theirs')

    confirm.mockReturnValue(true)
    await click('Cerrar n.md')
    expect(screen.queryByRole('button', { name: 'Cerrar n.md' })).toBeNull()
  })

  it('hands the route a guard for leaving /vault', async () => {
    const disk = new FakeDisk()
    disk.put('n.md', 'AAA')
    let guard: (() => Promise<boolean>) | null = null
    await mount(disk, { onGuard: (g) => (guard = g) })
    await click('n')
    append('typed')

    await act(async () => {
      expect(await guard!()).toBe(true)
    })
    expect(disk.contents('n.md')).toBe('AAAtyped')
  })
})

describe('renaming and trashing a folder (DEV-05)', () => {
  it('open tabs follow a renamed folder and keep saving without a banner', async () => {
    const disk = new FakeDisk()
    disk.put('carp/n.md', 'AAA')
    await mount(disk)
    await click(/^carp$/)
    await click('n')
    expect(screen.getByRole('button', { name: 'Cerrar carp/n.md' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar carp' }))
    const input = screen.getByRole('textbox', { name: 'Renombrar carp' })
    fireEvent.change(input, { target: { value: 'carp2' } })
    fireEvent.submit(input.closest('form')!)
    await settle(100)

    expect(screen.getByRole('button', { name: 'Cerrar carp2/n.md' })).toBeInTheDocument()
    append('!')
    await settle(2000)
    expect(disk.contents('carp2/n.md')).toBe('AAA!')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Guardado')).toBeInTheDocument()
  })

  it('trashing a folder closes the tabs of the notes inside it', async () => {
    const disk = new FakeDisk()
    disk.put('carp/n.md', 'AAA')
    disk.put('otra.md', 'x')
    await mount(disk)
    await click(/^carp$/)
    await click('n')

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar carp' }))
    await click('Eliminar')

    expect(screen.queryByRole('button', { name: 'Cerrar carp/n.md' })).toBeNull()
  })

  it('renaming a folder first saves the open note inside it', async () => {
    const disk = new FakeDisk()
    disk.put('carp/n.md', 'AAA')
    await mount(disk)
    await click(/^carp$/)
    await click('n')
    append('fresh')

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar carp' }))
    const input = screen.getByRole('textbox', { name: 'Renombrar carp' })
    fireEvent.change(input, { target: { value: 'carp2' } })
    fireEvent.submit(input.closest('form')!)
    await settle(100)

    expect(disk.contents('carp2/n.md')).toBe('AAAfresh')
  })
})

describe('gestures that fail say so', () => {
  it('"Nota de hoy" on a vault that refuses writes shows a message and opens nothing', async () => {
    const disk = new FakeDisk()
    await mount(disk)
    disk.failNextWith = new VaultError('permission_denied')

    await click(/Nota de hoy/)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Campus no tiene permiso para hacer eso en esa carpeta.',
    )
    expect(document.querySelector('.cm-editor')).toBeNull()
    expect([...disk.files.keys()]).toEqual([])
  })

  it('"Nota de hoy" opens the existing note instead of overwriting it', async () => {
    const disk = new FakeDisk()
    const now = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    disk.put(`Daily/${stamp}.md`, 'already here')
    await mount(disk)

    await click(/Nota de hoy/)
    expect(viewOf().state.doc.toString()).toBe('already here')
    expect(disk.writes).toEqual([])
  })

  it('"Nota de hoy" does not write over a note it could not check', async () => {
    const disk = new FakeDisk()
    const access = disk.access()
    access.stat = async () => {
      throw new VaultError('unavailable')
    }
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <FilesProvider access={access}>
          <WorkspaceShell vaultKey="/v" />
        </FilesProvider>
      </QueryClientProvider>,
    )
    await settle(50)
    await click(/Nota de hoy/)
    expect(disk.writes).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent(/servidor de Campus/)
  })

  it('creating "Nota.MD" keeps its name instead of becoming "Nota.MD.md"', async () => {
    const disk = new FakeDisk()
    disk.put('x.md', 'x')
    await mount(disk)
    await click('+ Nota')
    const input = screen.getByRole('textbox', { name: 'Nombre de la nota nueva' })
    fireEvent.change(input, { target: { value: 'Nota.MD' } })
    fireEvent.submit(input.closest('form')!)
    await settle(100)
    expect(disk.files.has('Nota.MD')).toBe(true)
    expect(disk.files.has('Nota.MD.md')).toBe(false)
  })

  it('a refused note name is one Spanish sentence, and clears when the text changes', async () => {
    const disk = new FakeDisk()
    disk.put('prueba.md', 'x')
    await mount(disk)
    await click('+ Nota')
    const input = screen.getByRole('textbox', { name: 'Nombre de la nota nueva' })
    fireEvent.change(input, { target: { value: 'prueba' } })
    fireEvent.submit(input.closest('form')!)
    await settle(100)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Ya existe una nota con ese nombre.')
    expect(alert.textContent).not.toMatch(/\.md|expected a new file/)

    fireEvent.change(input, { target: { value: 'prueba 2' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('the first run', () => {
  it('an empty vault offers one working "Creá tu primera nota" action', async () => {
    const disk = new FakeDisk()
    await mount(disk)

    await click('Creá tu primera nota')
    const input = screen.getByRole('textbox', { name: 'Nombre de la nota nueva' })
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: 'Primera' } })
    fireEvent.submit(input.closest('form')!)
    await settle(100)

    expect(disk.files.has('Primera.md')).toBe(true)
    expect(document.querySelector('.cm-editor')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Creá tu primera nota' })).toBeNull()
  })

  it('a vault with notes does not nag, and no longer offers a button that does nothing', async () => {
    const disk = new FakeDisk()
    disk.put('a.md', 'x')
    await mount(disk)
    expect(screen.queryByRole('button', { name: 'Creá tu primera nota' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Abrir el explorador' })).toBeNull()
  })
})

describe('opening a note on request (global search)', () => {
  it('opens the requested note and reports it handled', async () => {
    const disk = new FakeDisk()
    disk.put('carp/n.md', 'hola')
    const handled = vi.fn()
    await mount(disk, { openRequest: 'carp/n.md', onOpenRequestHandled: handled })
    await settle(50)
    expect(viewOf().state.doc.toString()).toBe('hola')
    expect(handled).toHaveBeenCalled()
    expect(within(document.body).getByRole('button', { name: 'Cerrar carp/n.md' })).toBeTruthy()
  })
})
