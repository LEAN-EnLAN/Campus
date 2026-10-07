import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { SubjectView } from '@/domain/types'
import { hasUserTime } from '@/features/items/due'

import { QuickCapture } from './quick-capture'

const subjects = [
  { id: 'algebra', name: 'Álgebra' },
  { id: 'paradigmas', name: 'Paradigmas de Programación' },
] as unknown as SubjectView[]

function mount(props: Partial<React.ComponentProps<typeof QuickCapture>> = {}) {
  const onSubmit = vi.fn()
  render(
    <QuickCapture
      open
      onOpenChange={vi.fn()}
      subjects={subjects}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return { onSubmit, user: userEvent.setup() }
}

describe('the add dialog', () => {
  it('is titled after what it will add, not "Agregar algo"', () => {
    mount()

    expect(screen.getByRole('dialog', { name: 'Agregar entrega' })).toBeInTheDocument()
    expect(screen.queryByText('Agregar algo')).toBeNull()
  })

  it('retitles itself when the type changes', async () => {
    const { user } = mount()

    await user.selectOptions(screen.getByLabelText('Tipo'), 'midterm')

    expect(screen.getByRole('dialog', { name: 'Agregar parcial' })).toBeInTheDocument()
  })

  it('keeps the course it was opened from', () => {
    mount({ defaultSubjectId: 'paradigmas' })

    expect(screen.getByLabelText('Materia')).toHaveValue('paradigmas')
  })

  it('asks for the date as dd/mm/aaaa, in a field that does not follow the browser locale', () => {
    mount()

    const date = screen.getByLabelText('Fecha')
    expect(date).toHaveAttribute('placeholder', 'dd/mm/aaaa')
    expect(date).not.toHaveAttribute('type', 'date')
  })
})

describe('saving', () => {
  it('stores a date with no time as date-only, not as 23:59', async () => {
    const { user, onSubmit } = mount()

    await user.type(screen.getByLabelText(/¿Qué es\?/), 'TP 1')
    await user.type(screen.getByLabelText('Fecha'), '23/10/2026')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    const saved = onSubmit.mock.calls[0]![0]
    expect(hasUserTime(saved.dueAt)).toBe(false)
    expect(new Date(saved.dueAt).getDate()).toBe(23)
    expect(new Date(saved.dueAt).getMonth()).toBe(9)
  })

  it('stores the time when one was typed, including 23:59', async () => {
    const { user, onSubmit } = mount()

    await user.type(screen.getByLabelText(/¿Qué es\?/), 'TP 1')
    await user.type(screen.getByLabelText('Fecha'), '23/10/2026')
    await user.type(screen.getByLabelText('Hora'), '23:59')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    const saved = onSubmit.mock.calls[0]![0]
    expect(hasUserTime(saved.dueAt)).toBe(true)
  })

  it('saves without a date at all', async () => {
    const { user, onSubmit } = mount()

    await user.type(screen.getByLabelText(/¿Qué es\?/), 'TP sin fecha')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onSubmit.mock.calls[0]![0].dueAt).toBeNull()
  })
})

describe('validation', () => {
  it('names an impossible date in Spanish, inline, linked to the field and announced', async () => {
    const { user, onSubmit } = mount()

    await user.type(screen.getByLabelText(/¿Qué es\?/), 'TP 1')
    await user.type(screen.getByLabelText('Fecha'), '31/02/2026')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    const field = screen.getByLabelText('Fecha')
    const message = screen.getByText(
      'Escribí la fecha como dd/mm/aaaa, por ejemplo 23/10/2026.',
    )
    expect(message).toHaveAttribute('role', 'alert')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field.getAttribute('aria-describedby')).toContain(message.id)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps the title message and announces it', async () => {
    const { user, onSubmit } = mount()

    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByText('Poné un título.')).toHaveAttribute('role', 'alert')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('asks for a date when a time was typed without one', async () => {
    const { user, onSubmit } = mount()

    await user.type(screen.getByLabelText(/¿Qué es\?/), 'TP 1')
    await user.type(screen.getByLabelText('Hora'), '18:30')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByText('Elegí también el día.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("never shows the browser's own validation text: the form opts out of it", () => {
    mount()

    expect(screen.getByRole('dialog').querySelector('form')).toHaveAttribute('novalidate')
  })
})

describe('modal behaviour', () => {
  it('closes with Escape and focuses the first field', async () => {
    const onOpenChange = vi.fn()
    const { user } = mount({ onOpenChange })

    await vi.waitFor(() => expect(screen.getByLabelText(/¿Qué es\?/)).toHaveFocus())
    await user.keyboard('{Escape}')

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('scheduling a Final', () => {
  const withPrerequisite = [
    { id: 'am1', name: 'Análisis I', missingRequirements: [] },
    {
      id: 'am2',
      name: 'Análisis II',
      missingRequirements: [
        { curriculumSubjectId: 'am1', name: 'Análisis I', kind: 'to_pass', needs: 'aprobar' },
      ],
    },
  ] as unknown as SubjectView[]

  async function scheduleFinal(user: ReturnType<typeof userEvent.setup>, date = '10/12/2026') {
    await user.type(screen.getByLabelText(/¿Qué es\?/), 'Final de Análisis II')
    await user.selectOptions(screen.getByLabelText('Tipo'), 'final')
    await user.selectOptions(screen.getByLabelText('Materia'), 'am2')
    await user.type(screen.getByLabelText('Fecha'), date)
  }

  it('shows a non-blocking note when the prerequisite is not passed nor scheduled earlier', async () => {
    const { user, onSubmit } = mount({ subjects: withPrerequisite, items: [] })

    await scheduleFinal(user)

    expect(screen.getByText(/El plan pide tener aprobada Análisis I/)).toBeInTheDocument()
    // Not a modal, not a block: saving still works.
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('drops the note once the prerequisite has an earlier final', async () => {
    const earlier = [
      {
        id: 'f1',
        curriculumSubjectId: 'am1',
        kind: 'final',
        title: 'Final AM I',
        startsAt: null,
        dueAt: new Date(2026, 11, 3, 9, 0).toISOString(),
        status: 'open',
        notes: null,
      },
    ]
    const { user } = mount({ subjects: withPrerequisite, items: earlier as never })

    await scheduleFinal(user)

    expect(screen.queryByText(/El plan pide tener aprobada/)).toBeNull()
  })

  it('says nothing for other kinds of item', async () => {
    const { user } = mount({ subjects: withPrerequisite, items: [] })

    await user.selectOptions(screen.getByLabelText('Materia'), 'am2')
    await user.type(screen.getByLabelText('Fecha'), '10/12/2026')

    expect(screen.queryByText(/El plan pide tener aprobada/)).toBeNull()
  })
})
