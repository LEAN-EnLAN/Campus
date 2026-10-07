import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { VaultError } from '@/lib/vault/errors'

import { FilesProvider } from '@/lib/files/context'
import { sessionFor } from '@/lib/knowledge/session-index'

import { FakeDisk } from '../../../tests/support/fake-disk'
import { SubjectNotes } from './subject-notes'

/**
 * The "Notas" section of a materia: the notes that [[link]] it, and a way to
 * start one that already does. Only with a local folder; in the cloud there is
 * nothing here at all, not even a placeholder.
 */

const SUBJECT = { id: 'math1', name: 'Análisis Matemático I', code: 'AM1' }

const today = () => {
  const date = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

async function mount(disk: FakeDisk | null) {
  const files = disk?.access() ?? null
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <FilesProvider access={files}>
          <Outlet />
        </FilesProvider>
      </QueryClientProvider>
    ),
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <SubjectNotes subject={SUBJECT} />,
  })
  const vault = createRoute({
    getParentRoute: () => root,
    path: '/vault',
    validateSearch: (s: Record<string, unknown>) => ({ note: String(s.note ?? '') }),
    component: () => <p>workspace</p>,
  })
  const router = createRouter({
    routeTree: root.addChildren([home, vault]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  window.scrollTo = (() => {}) as typeof window.scrollTo
  render(<RouterProvider router={router} />)
  await router.load()
  return { router, files }
}

describe('Notas de esta materia', () => {
  it('is not there at all without a local folder', async () => {
    await mount(null)

    expect(screen.queryByRole('heading', { name: /Notas/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Nota de esta materia/ })).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/Ninguna nota menciona/)
  })

  it('lists the notes that link the materia, by title and the line it is on', async () => {
    const disk = new FakeDisk()
    disk.put('Notas/Clase 1.md', '# Clase 1\n\nMateria: [[Análisis Matemático I]]\n')
    disk.put('Notas/Otra.md', '# Otra\n\nNada que ver.\n')
    await mount(disk)

    const section = (await screen.findByRole('heading', { name: 'Notas' })).closest('section')!
    expect(await within(section).findByRole('link', { name: /Clase 1/ })).toBeInTheDocument()
    expect(within(section).getByText('Materia: [[Análisis Matemático I]]')).toBeInTheDocument()
    expect(within(section).queryByText('Otra')).toBeNull()
  })

  it('finds a note by the materia code too', async () => {
    const disk = new FakeDisk()
    disk.put('apuntes.md', '# Apuntes\n\nVer [[AM1]].\n')
    await mount(disk)

    expect(await screen.findByRole('link', { name: /Apuntes/ })).toBeInTheDocument()
  })

  it('says, once, that no note mentions it yet — and the one action stays in the header', async () => {
    const disk = new FakeDisk()
    disk.put('x.md', 'sin enlaces')
    await mount(disk)

    expect(
      await screen.findByText('Ninguna nota menciona esta materia todavía.'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '+ Nota de esta materia' })).toHaveLength(1)
  })

  it('shows five and offers the rest', async () => {
    const disk = new FakeDisk()
    for (let n = 1; n <= 7; n++)
      disk.put(`n${n}.md`, `# Nota ${n}\n\n[[Análisis Matemático I]]\n`)
    const user = userEvent.setup()
    await mount(disk)

    await screen.findByRole('link', { name: /Nota 1/ })
    expect(screen.getAllByRole('link')).toHaveLength(5)

    await user.click(screen.getByRole('button', { name: 'Ver todas (7)' }))
    expect(screen.getAllByRole('link')).toHaveLength(7)
  })

  it('creates a note already linked to the materia and opens it', async () => {
    const disk = new FakeDisk()
    const user = userEvent.setup()
    const { router } = await mount(disk)

    await user.click(await screen.findByRole('button', { name: '+ Nota de esta materia' }))

    const stamp = today()
    const path = `Notas/Análisis Matemático I - ${stamp}.md`
    expect(disk.contents(path)).toBe(
      `# Análisis Matemático I - ${stamp}\n\nMateria: [[Análisis Matemático I]]\n\n`,
    )
    expect(await screen.findByText('workspace')).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ note: path })
  })

  it('the new note shows up in the list straight away, without a re-scan', async () => {
    const disk = new FakeDisk()
    const user = userEvent.setup()
    const { files } = await mount(disk)
    await screen.findByText('Ninguna nota menciona esta materia todavía.')
    const readsBefore = disk.reads.length

    await user.click(screen.getByRole('button', { name: '+ Nota de esta materia' }))
    await screen.findByText('workspace')

    const mentions = sessionFor(files!).index.mentions('Análisis Matemático I')
    expect(mentions).toHaveLength(1)
    expect(disk.reads.length).toBe(readsBefore)
  })

  it('does not overwrite a note of the same name made earlier today', async () => {
    const disk = new FakeDisk()
    disk.put(`Notas/Análisis Matemático I - ${today()}.md`, 'lo de la mañana')
    const user = userEvent.setup()
    const { router } = await mount(disk)

    await user.click(await screen.findByRole('button', { name: '+ Nota de esta materia' }))
    await screen.findByText('workspace')

    expect(disk.contents(`Notas/Análisis Matemático I - ${today()}.md`)).toBe('lo de la mañana')
    expect(router.state.location.search).toEqual({
      note: `Notas/Análisis Matemático I - ${today()} (2).md`,
    })
  })

  it('a refusal reads as a Spanish sentence and nothing opens', async () => {
    const disk = new FakeDisk()
    disk.failNextWith = new VaultError('permission_denied', 'denied')
    const user = userEvent.setup()
    await mount(disk)

    await user.click(await screen.findByRole('button', { name: '+ Nota de esta materia' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Campus no tiene permiso para hacer eso en esa carpeta.',
    )
    expect(screen.queryByText('workspace')).toBeNull()
  })
})
