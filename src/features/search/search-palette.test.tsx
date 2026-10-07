import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FilesProvider } from '@/lib/files/context'

import { FakeDisk } from '../../../tests/support/fake-disk'

import { SearchPalette } from './search-palette'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

/**
 * Global search finds notes (EST-06): by title and by body, accent-insensitive
 * like the rest, through the SAME index the workspace uses — one scan per
 * session, none per keystroke — and says nothing about notes without a vault.
 */

function vault() {
  const disk = new FakeDisk()
  disk.put(
    'Análisis/Clase 3.md',
    '# Clase 3\n\nHoy vimos el criterio de los límites laterales.\n',
  )
  disk.put('Daily/2026-08-14.md', '# 2026-08-14\n\n- [ ] repasar Fubini\n')
  disk.put('Física.md', '# Física\n\nmecánica')
  return disk
}

async function mount(disk: FakeDisk | null) {
  const view = render(
    <FilesProvider access={disk ? disk.access() : null}>
      <SearchPalette
        open
        onOpenChange={() => {}}
        subjects={[]}
        items={[]}
        resources={[]}
        prerequisitesKnown
      />
    </FilesProvider>,
  )
  await act(async () => void (await new Promise((r) => setTimeout(r, 30))))
  return view
}

beforeEach(() => navigate.mockReset())

describe('notes in global search', () => {
  it('finds a note by a word in its BODY, with accents typed or not', async () => {
    const user = userEvent.setup()
    await mount(vault())
    const box = screen.getByRole('combobox')

    await user.type(box, 'límites')
    expect(await screen.findByRole('option', { name: /Clase 3/ })).toBeInTheDocument()

    await user.clear(box)
    await user.type(box, 'LIMITES')
    expect(await screen.findByRole('option', { name: /Clase 3/ })).toBeInTheDocument()
  })

  it('finds a note by its title', async () => {
    const user = userEvent.setup()
    await mount(vault())
    await user.type(screen.getByRole('combobox'), 'fisica')
    expect(await screen.findByRole('option', { name: /Física/ })).toBeInTheDocument()
  })

  it('opens the note in the workspace on Enter and on click', async () => {
    const user = userEvent.setup()
    await mount(vault())
    await user.type(screen.getByRole('combobox'), 'fubini{Enter}')
    expect(navigate).toHaveBeenCalledWith({
      to: '/vault',
      search: { note: 'Daily/2026-08-14.md' },
    })

    navigate.mockReset()
    await user.clear(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'mecanica')
    await user.click(await screen.findByRole('option', { name: /Física/ }))
    expect(navigate).toHaveBeenCalledWith({ to: '/vault', search: { note: 'Física.md' } })
  })

  it('never shows the .md extension', async () => {
    const user = userEvent.setup()
    await mount(vault())
    await user.type(screen.getByRole('combobox'), 'clase')
    const option = await screen.findByRole('option', { name: /Clase 3/ })
    expect(option.textContent).not.toMatch(/\.md/)
  })

  it('scans the vault once, however much is typed', async () => {
    const user = userEvent.setup()
    const disk = vault()
    await mount(disk)
    const readsAfterOpen = disk.reads.length
    expect(readsAfterOpen).toBe(3)

    await user.type(screen.getByRole('combobox'), 'limites laterales')
    await user.clear(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'fubini')
    expect(disk.reads.length).toBe(readsAfterOpen)
  })

  it('the placeholder mentions notes only when there is a vault', async () => {
    const { unmount } = await mount(vault())
    expect(screen.getByPlaceholderText(/notas/)).toBeInTheDocument()
    unmount()

    await mount(null)
    expect(
      screen.getByPlaceholderText('Buscar materias, entregas, material…'),
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox').getAttribute('aria-label')).not.toMatch(/notas/)
  })

  it('without a vault (cloud) nothing about notes appears, and nothing is scanned', async () => {
    const user = userEvent.setup()
    await mount(null)
    await user.type(screen.getByRole('combobox'), 'limites')
    expect(screen.queryByRole('option')).toBeNull()
    expect(screen.getByText(/No encontramos nada/)).toBeInTheDocument()
  })
})
