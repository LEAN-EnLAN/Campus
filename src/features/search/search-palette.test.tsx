import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { computeSubjectViews } from '@/domain/availability'
import { normalize } from '@/domain/search'
import type { AcademicItem, Resource } from '@/domain/types'
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

describe('academic results: grouped, highlighted, deep-linked', () => {
  const subjects = computeSubjectViews({
    subjects: [
      {
        id: 'fis',
        curriculumId: 'cur',
        subjectId: 's-fis',
        code: null,
        name: 'Física I',
        normalizedName: normalize('Física I'),
        yearLevel: 1,
        term: 'anual',
        credits: null,
        elective: false,
        displayOrder: 0,
      },
    ],
    prerequisites: [],
    states: [],
  })
  const items: AcademicItem[] = [
    {
      id: 'tp',
      curriculumSubjectId: 'fis',
      kind: 'assignment',
      title: 'Informe de péndulo',
      startsAt: null,
      // Local time, so the day under test does not drift with the TZ.
      dueAt: new Date(2026, 10, 13, 18, 0).toISOString(),
      status: 'open',
      notes: null,
    },
  ]
  const resources: Resource[] = [
    {
      id: 'apunte',
      curriculumSubjectId: 'fis',
      kind: 'link',
      title: 'Apunte de física',
      url: 'https://campus.example.org/fisica.pdf',
      storagePath: null,
      body: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    },
    {
      id: 'suelto',
      curriculumSubjectId: null,
      kind: 'link',
      title: 'Guía suelta de física',
      url: null,
      storagePath: null,
      body: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ]

  function mountAcademic() {
    return render(
      <FilesProvider access={null}>
        <SearchPalette
          open
          onOpenChange={() => {}}
          subjects={subjects}
          items={items}
          resources={resources}
          prerequisitesKnown
        />
      </FilesProvider>,
    )
  }

  it('groups results by type, each group named with its count', async () => {
    const user = userEvent.setup()
    mountAcademic()
    await user.type(screen.getByRole('combobox'), 'fisica')
    expect(screen.getAllByRole('group')).toHaveLength(3)
    expect(screen.getByRole('group', { name: /Materias\s*1/ })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Entregas y fechas\s*1/ })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Material\s*2/ })).toBeInTheDocument()
    expect(screen.getByText(/4 resultados/)).toBeInTheDocument()
  })

  it('marks the matched text, accents or not', async () => {
    const user = userEvent.setup()
    mountAcademic()
    await user.type(screen.getByRole('combobox'), 'pendulo')
    const marks = [...document.querySelectorAll('mark')].map((m) => m.textContent)
    expect(marks).toContain('péndulo')
  })

  it('arrow keys cross groups; Enter on an entrega opens the calendar on its day', async () => {
    const user = userEvent.setup()
    mountAcademic()
    await user.type(screen.getByRole('combobox'), 'fisica')
    // Materias (1) → Entregas (1): one step down crosses the group boundary.
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'Informe de péndulo',
    )
    await user.keyboard('{Enter}')
    expect(navigate).toHaveBeenCalledWith({ to: '/calendar', search: { date: '2026-11-13' } })
  })

  it('finds an entrega by its weekday', async () => {
    const user = userEvent.setup()
    mountAcademic()
    await user.type(screen.getByRole('combobox'), 'viernes')
    expect(screen.getByRole('option', { name: /Informe de péndulo/ })).toBeInTheDocument()
  })

  it('a resource opens its materia; one without materia opens the library', async () => {
    const user = userEvent.setup()
    mountAcademic()
    const box = screen.getByRole('combobox')
    await user.type(box, 'apunte')
    await user.click(screen.getByRole('option', { name: /Apunte de física/ }))
    expect(navigate).toHaveBeenCalledWith({
      to: '/courses/$courseId',
      params: { courseId: 'fis' },
    })

    navigate.mockReset()
    await user.clear(box)
    await user.type(box, 'suelta')
    await user.click(screen.getByRole('option', { name: /Guía suelta/ }))
    expect(navigate).toHaveBeenCalledWith({ to: '/library' })
  })
})
