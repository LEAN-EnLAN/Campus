import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/toast'
import type { QuickCaptureValues } from '@/components/quick-capture'
import type { AcademicItem } from '@/domain/types'
import { acceptSharedCapture, PENDING_CAPTURE_KEY } from '@/features/items/share'
import { Route } from '@/routes/_app/today'

import { renderRoute } from '../helpers/render-route'

/**
 * WP1 on Hoy: "Copiar para WhatsApp", "Descargar .ics", and a shared `/add`
 * draft opening the capture form — saved only when the student confirms.
 */

const state = vi.hoisted(() => ({
  items: [] as AcademicItem[],
  views: [] as { id: string; name: string; status: string; yearLevel: number }[],
  createAsync: vi.fn<(values: QuickCaptureValues) => Promise<void>>(),
  track: vi.fn(),
  download: vi.fn(),
}))

vi.mock('@/features/items/queries', () => ({
  useAcademicItems: () => ({
    data: state.items,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useToggleAcademicItem: () => ({ mutate: vi.fn() }),
  useCreateAcademicItem: () => ({
    mutateAsync: state.createAsync,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
  useUpdateAcademicItem: () => ({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
  useDeleteAcademicItem: () => ({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
}))
vi.mock('@/features/academic/queries', () => ({
  useSetSubjectStatus: () => ({ mutate: vi.fn() }),
  useAcademicPlan: () => ({
    views: state.views,
    subjectById: new Map(state.views.map((v) => [v.id, v])),
    hasContext: true,
    isUnmapped: false,
    isLoading: false,
    error: null,
    progress: { total: 10, passed: 1, equivalent: 0 },
  }),
}))
vi.mock('@/lib/telemetry/track', () => ({
  track: (...args: unknown[]) => state.track(...args),
}))
vi.mock('@/lib/download', () => ({
  downloadFile: (...args: unknown[]) => state.download(...args),
}))

const Today = Route.options.component as () => ReactNode

const NOW = new Date()
const at = (days: number, h = 12) =>
  new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days, h, 0, 0).toISOString()

const item = (id: string, over: Partial<AcademicItem> = {}): AcademicItem => ({
  id,
  curriculumSubjectId: null,
  kind: 'assignment',
  title: id,
  startsAt: null,
  dueAt: null,
  status: 'open',
  notes: null,
  ...over,
})

const mount = () =>
  renderRoute(() => (
    <ToastProvider>
      <Today />
    </ToastProvider>
  ))

beforeEach(() => {
  state.items = []
  state.views = [{ id: 'alg', name: 'Álgebra', status: 'in_progress', yearLevel: 1 }]
  state.createAsync = vi.fn().mockResolvedValue(undefined)
  state.track = vi.fn()
  state.download = vi.fn()
})

afterEach(() => window.sessionStorage.clear())

describe('Copiar para WhatsApp', () => {
  it('copies the line and the /add link, says "Copiado" and counts it with the same ref', async () => {
    const user = userEvent.setup()
    state.items = [
      item('Parcial 1', {
        kind: 'midterm',
        curriculumSubjectId: 'alg',
        dueAt: at(2, 18),
        notes: 'apuntes privados',
      }),
    ]
    mount()

    await user.click(
      await screen.findByRole('button', { name: 'Copiar Parcial 1 para WhatsApp' }),
    )

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copiado'))
    const copied = await navigator.clipboard.readText()
    const [line, link] = copied.split('\n')
    expect(line).toMatch(/^Parcial · Álgebra · \S+ \d{2}\/\d{2} 18:00$/)
    const url = new URL(link ?? '')
    expect(url.pathname).toBe('/add')
    expect(url.searchParams.get('subject')).toBe('alg')
    expect(copied).not.toContain('apuntes privados')
    expect(state.track).toHaveBeenCalledWith('share_copied', {
      ref: url.searchParams.get('ref'),
    })
  })
})

describe('Descargar .ics', () => {
  it('downloads a dated item as a calendar file', async () => {
    const user = userEvent.setup()
    state.items = [item('TP 2', { dueAt: at(1) })]
    mount()

    await user.click(await screen.findByRole('button', { name: 'Descargar .ics de TP 2' }))

    expect(state.download).toHaveBeenCalledWith(
      'tp-2.ics',
      expect.stringContaining('BEGIN:VCALENDAR\r\n'),
      'text/calendar;charset=utf-8',
    )
  })

  it('stays visible but disabled for an undated item, and says why', async () => {
    const user = userEvent.setup()
    state.items = [item('Leer')]
    mount()

    const button = await screen.findByRole('button', { name: 'Descargar .ics de Leer' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription(/Sin fecha/)

    await user.click(button)
    expect(state.download).not.toHaveBeenCalled()
  })
})

describe('a shared link, opened on Hoy', () => {
  it('opens the capture form prefilled and saves nothing until Guardar', async () => {
    const user = userEvent.setup()
    acceptSharedCapture(
      '?kind=midterm&title=Primer%20parcial&subject=so-14&subjectName=Sistemas%20Operativos&ref=abcdefgh',
    )
    mount()

    const dialog = await screen.findByRole('dialog', { name: 'Agregar parcial' })
    // Not in this plan: no subject, its name in the title. Never guessed by name.
    expect(within(dialog).getByRole('textbox', { name: '¿Qué es?' })).toHaveValue(
      'Primer parcial (Sistemas Operativos)',
    )
    expect(within(dialog).getByLabelText('Materia')).toHaveValue('')
    expect(state.createAsync).not.toHaveBeenCalled()
    expect(state.track).not.toHaveBeenCalled()
    // Read once: a reload does not open it again.
    expect(window.sessionStorage.getItem(PENDING_CAPTURE_KEY)).toBeNull()

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(state.createAsync).toHaveBeenCalledWith({
      title: 'Primer parcial (Sistemas Operativos)',
      kind: 'midterm',
      curriculumSubjectId: null,
      dueAt: null,
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(state.track).toHaveBeenCalledWith('share_saved', { ref: 'abcdefgh' })
  })

  it('preselects the subject when the same id is in the plan', async () => {
    acceptSharedCapture('?kind=assignment&title=TP%201&subject=alg&subjectName=%C3%81lgebra')
    mount()

    const dialog = await screen.findByRole('dialog', { name: 'Agregar entrega' })
    expect(within(dialog).getByLabelText('Materia')).toHaveValue('alg')
    expect(within(dialog).getByRole('textbox', { name: '¿Qué es?' })).toHaveValue('TP 1')
  })

  it('saves nothing and counts nothing when the student cancels', async () => {
    const user = userEvent.setup()
    acceptSharedCapture('?kind=final&title=Final&ref=abcdefgh')
    mount()

    const dialog = await screen.findByRole('dialog', { name: 'Agregar final' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(state.createAsync).not.toHaveBeenCalled()
    expect(state.track).not.toHaveBeenCalled()
  })

  it('opens nothing without a shared draft', async () => {
    mount()

    await screen.findByRole('heading', { name: 'Hoy', level: 1 })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
