import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { edge, state, subject } from '@/domain/test-fixtures'
import type { AcademicItem, Resource } from '@/domain/types'
import type { CampusBackend } from '@/lib/backends/types'

import {
  emptyStore,
  fakeCampusBackend,
  renderScreen,
  type FakeStore,
} from '../../../tests/support/fake-campus-backend'
import { CourseDetailScreen } from './course-detail-screen'

const inDays = (days: number) => {
  const at = new Date()
  at.setDate(at.getDate() + days)
  at.setHours(9, 0, 0, 0)
  return at.toISOString()
}

const item = (id: string, title: string, dueAt: string | null): AcademicItem => ({
  id,
  curriculumSubjectId: 'am2',
  kind: 'midterm',
  title,
  startsAt: null,
  dueAt,
  status: 'open',
  notes: null,
})

/** Análisis II needs AM I and Álgebra; it unlocks Análisis Numérico. */
function setup({
  items = [],
  resources = [],
  over = {},
}: { items?: AcademicItem[]; resources?: Resource[]; over?: Partial<FakeStore> } = {}) {
  const store = emptyStore({
    subjects: [
      subject('am1', 'Análisis Matemático I'),
      subject('ag', 'Álgebra'),
      subject('am2', 'Análisis Matemático II', { yearLevel: 2 }),
      subject('an', 'Análisis Numérico', { yearLevel: 3 }),
    ],
    prerequisites: [
      edge('am2', 'am1', 'to_take'),
      edge('am2', 'ag', 'to_take'),
      edge('am2', 'am1', 'to_pass'),
      edge('an', 'am2', 'to_take'),
    ],
    states: [state('am1', 'passed'), state('ag', 'passed'), state('am2', 'in_progress')],
    ...over,
  })
  const backend: CampusBackend = {
    ...fakeCampusBackend(store),
    items: { list: async () => items } as unknown as CampusBackend['items'],
    resources: {
      list: async () => resources,
      create: async () => {
        throw new Error('not used')
      },
      remove: async () => {},
    },
  }
  return { store, backend }
}

const picker = () => screen.getByRole('group', { name: '¿Cómo vas?' })

describe('the materia header', () => {
  it('shows the status once, as the picker, and changes it from there', async () => {
    const { store, backend } = setup()
    await renderScreen(<CourseDetailScreen courseId="am2" />, backend)
    const user = userEvent.setup()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Análisis Matemático II' }),
    ).toBeInTheDocument()
    expect(within(picker()).getByRole('button', { name: 'Cursando' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(picker()).getAllByRole('button', { pressed: true })).toHaveLength(1)
    // No second control or badge repeating it.
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByText('Estado académico')).toBeNull()

    await user.click(within(picker()).getByRole('button', { name: 'Aprobada' }))

    await waitFor(() =>
      expect(store.writes.at(-1)).toEqual([{ curriculumSubjectId: 'am2', status: 'passed' }]),
    )
    await waitFor(() =>
      expect(within(picker()).getByRole('button', { name: 'Aprobada' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
  })

  it('clears the stored status with Sin marcar and says what the plan derives', async () => {
    const { store, backend } = setup()
    await renderScreen(<CourseDetailScreen courseId="am2" />, backend)
    const user = userEvent.setup()

    await screen.findByRole('group', { name: '¿Cómo vas?' })
    await user.click(within(picker()).getByRole('button', { name: 'Sin marcar' }))
    await waitFor(() =>
      expect(store.writes.at(-1)).toEqual([{ curriculumSubjectId: 'am2', status: null }]),
    )
    expect(
      await screen.findByText('2° año · Anual · Disponible para cursar'),
    ).toBeInTheDocument()
  })

  it('offers one Agregar entrega, which opens the capture for this materia', async () => {
    const { backend } = setup()
    await renderScreen(<CourseDetailScreen courseId="am2" />, backend)
    const user = userEvent.setup()

    const add = await screen.findAllByRole('button', { name: 'Agregar entrega' })
    expect(add).toHaveLength(1)
    await user.click(add[0]!)
    expect(await screen.findByRole('dialog', { name: 'Agregar entrega' })).toBeInTheDocument()
  })
})

describe('the summary strip', () => {
  it('leads with the next date, correlativas met, what it unlocks and material', async () => {
    const { backend } = setup({
      items: [item('a', 'Segundo parcial', inDays(8)), item('b', 'TP 1', inDays(3))],
      resources: [
        {
          id: 'r1',
          curriculumSubjectId: 'am2',
          kind: 'link',
          title: 'Guía',
          url: 'https://example.com',
          storagePath: null,
          body: null,
          createdAt: '2026-11-01T00:00:00Z',
        },
      ],
    })
    await renderScreen(<CourseDetailScreen courseId="am2" />, backend)

    const strip = await screen.findByLabelText('Resumen de la materia')
    expect(await within(strip).findByText('TP 1')).toBeInTheDocument()
    expect(within(strip).getByText(/1 fecha más/)).toBeInTheDocument()
    expect(within(strip).getByText('3')).toBeInTheDocument() // días
    expect(within(strip).getByText('2/2')).toBeInTheDocument()
    expect(within(strip).getByText('materia del plan')).toBeInTheDocument()
    expect(within(strip).getByText('recurso guardado')).toBeInTheDocument()
  })

  it('never shows a correlativas count for a plan that did not publish them', async () => {
    const { backend } = setup()
    const unknown: CampusBackend = {
      ...backend,
      catalog: {
        curriculumBundle: async () => ({
          ...(await backend.catalog.curriculumBundle(null as never)),
          prerequisites: [],
          prerequisitesKnown: false,
        }),
      } as unknown as CampusBackend['catalog'],
    }
    await renderScreen(<CourseDetailScreen courseId="am1" />, unknown)

    const strip = await screen.findByLabelText('Resumen de la materia')
    expect(within(strip).getByText('El plan no las publicó')).toBeInTheDocument()
    expect(screen.getByText(/no lo vamos a inventar/)).toBeInTheDocument()
  })
})

describe('the sections', () => {
  it('lists Material in one place, with its add action inside', async () => {
    const { backend } = setup()
    await renderScreen(<CourseDetailScreen courseId="am2" />, backend)

    const material = (await screen.findByRole('heading', { name: 'Material' })).closest(
      'section',
    )!
    expect(screen.getAllByRole('heading', { name: 'Material' })).toHaveLength(1)
    expect(
      await within(material).findByText('Todavía no guardaste material de esta materia.'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Agregar material' })).toHaveLength(1)
  })

  it('calls out what a blocked materia is missing and links what it unlocks', async () => {
    const { backend } = setup({ over: { states: [state('am1', 'passed')] } })
    await renderScreen(<CourseDetailScreen courseId="am2" />, backend)

    const correlativas = (await screen.findByRole('heading', { name: 'Correlativas' })).closest(
      'section',
    )!
    expect(within(correlativas).getByRole('note')).toHaveTextContent(
      'Para cursarla te falta cursar Álgebra.',
    )
    const cursar = within(correlativas).getByRole('list', { name: /Para cursar/ })
    expect(within(cursar).getByText('Te falta cursarla')).toBeInTheDocument()
    const unlocks = within(correlativas).getByRole('list', { name: /Habilita/ })
    expect(within(unlocks).getByRole('link', { name: /Análisis Numérico/ })).toHaveAttribute(
      'href',
      '/courses/an',
    )
  })

  it('orders dates by what is still to do and folds the done ones away', async () => {
    const { backend } = setup({
      items: [
        item('a', 'Segundo parcial', inDays(8)),
        item('b', 'Primer parcial', inDays(-10)),
        { ...item('c', 'TP 0', inDays(-20)), status: 'done' },
      ],
    })
    await renderScreen(<CourseDetailScreen courseId="am2" />, backend)

    const fechas = (await screen.findByRole('heading', { name: 'Próximas fechas' })).closest(
      'section',
    )!
    const [first, second] = within(fechas).getAllByRole('listitem')
    expect(first).toHaveTextContent('Primer parcial')
    expect(first).toHaveTextContent('Atrasada')
    expect(second).toHaveTextContent('Segundo parcial')
    expect(second).toHaveTextContent('En 8 días')
    expect(within(fechas).getByText('1 fecha hecha')).toBeInTheDocument()
  })
})
