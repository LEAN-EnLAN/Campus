import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { AcademicItem, SubjectView } from '@/domain/types'
import { dateOnlyDueAt, hasUserTime } from '@/features/items/due'

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
  it('keeps the draft open and rejects dismissal and submit while saving', async () => {
    const onOpenChange = vi.fn()
    const { user, onSubmit } = mount({ isPending: true, onOpenChange })

    await user.type(screen.getByRole('textbox', { name: '¿Qué es?' }), 'TP pendiente')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    await user.keyboard('{Escape}')
    // The backdrop is pointer-only and hidden from the accessibility tree.
    await user.click(screen.getByRole('dialog').previousElementSibling!)
    await user.type(screen.getByRole('textbox', { name: '¿Qué es?' }), '{Enter}')

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: '¿Qué es?' })).toHaveValue('TP pendiente')
  })

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

describe('editing an item', () => {
  const parcial = (over: Partial<AcademicItem> = {}): AcademicItem => ({
    id: 'p1',
    curriculumSubjectId: 'algebra',
    kind: 'midterm',
    title: 'Parcial 1',
    startsAt: null,
    dueAt: new Date(2026, 9, 23, 18, 30).toISOString(),
    status: 'open',
    notes: null,
    ...over,
  })

  it('opens prefilled, titled after the item, with "Guardar cambios"', () => {
    mount({ item: parcial() })

    expect(screen.getByRole('dialog', { name: 'Editar parcial' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '¿Qué es?' })).toHaveValue('Parcial 1')
    expect(screen.getByLabelText('Tipo')).toHaveValue('midterm')
    expect(screen.getByLabelText('Materia')).toHaveValue('algebra')
    expect(screen.getByLabelText('Fecha')).toHaveValue('23/10/2026')
    expect(screen.getByLabelText('Hora')).toHaveValue('18:30')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('opens a date-only item with the time empty, never 23:59', () => {
    mount({ item: parcial({ dueAt: dateOnlyDueAt(2026, 10, 23) }) })

    expect(screen.getByLabelText('Fecha')).toHaveValue('23/10/2026')
    expect(screen.getByLabelText('Hora')).toHaveValue('')
  })

  it('keeps the stored instant exactly when the date was not touched', async () => {
    const dueAt = dateOnlyDueAt(2026, 10, 23)
    const { user, onSubmit } = mount({ item: parcial({ dueAt }) })

    const title = screen.getByRole('textbox', { name: '¿Qué es?' })
    await user.clear(title)
    await user.type(title, 'Parcial 1 (recuperatorio)')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Parcial 1 (recuperatorio)',
      kind: 'midterm',
      curriculumSubjectId: 'algebra',
      dueAt,
    })
  })

  it('saves a changed date, time and subject', async () => {
    const { user, onSubmit } = mount({ item: parcial() })

    const date = screen.getByLabelText('Fecha')
    await user.clear(date)
    await user.type(date, '30/10/2026')
    await user.clear(screen.getByLabelText('Hora'))
    await user.selectOptions(screen.getByLabelText('Materia'), 'paradigmas')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const values = onSubmit.mock.calls[0]![0] as { dueAt: string; curriculumSubjectId: string }
    expect(values.curriculumSubjectId).toBe('paradigmas')
    // Time cleared: the item becomes date-only, not "due at 23:59".
    expect(values.dueAt).toBe(dateOnlyDueAt(2026, 10, 30))
    expect(hasUserTime(values.dueAt)).toBe(false)
  })

  it('keeps the same validation: an impossible date is refused and nothing is saved', async () => {
    const { user, onSubmit } = mount({ item: parcial() })

    const date = screen.getByLabelText('Fecha')
    await user.clear(date)
    await user.type(date, '31/02/2026')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(date).toHaveAttribute('aria-invalid', 'true')
    expect(
      screen.getByText('Escribí la fecha como dd/mm/aaaa, por ejemplo 23/10/2026.'),
    ).toHaveAttribute('role', 'alert')
  })

  it('refuses a time with no day, and an emptied title', async () => {
    const { user, onSubmit } = mount({ item: parcial() })

    await user.clear(screen.getByLabelText('Fecha'))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(screen.getByText('Elegí también el día.')).toBeInTheDocument()

    await user.clear(screen.getByRole('textbox', { name: '¿Qué es?' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(screen.getByText('Poné un título.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps a subject that is no longer in the plan instead of clearing it', async () => {
    const { user, onSubmit } = mount({ item: parcial({ curriculumSubjectId: 'gone' }) })

    expect(screen.getByLabelText('Materia')).toHaveValue('gone')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ curriculumSubjectId: 'gone' }),
    )
  })

  it('says "Guardando…" and blocks a second save while pending', async () => {
    const { user, onSubmit } = mount({ item: parcial(), isPending: true })

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: '¿Qué es?' }), '{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('opened with initialValues (a shared link)', () => {
  it('prefills every field it was given', () => {
    mount({
      initialValues: {
        title: 'Primer parcial',
        kind: 'midterm',
        curriculumSubjectId: 'algebra',
        dueAt: new Date(2026, 10, 18, 18, 30).toISOString(),
      },
    })

    expect(screen.getByRole('dialog', { name: 'Agregar parcial' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '¿Qué es?' })).toHaveValue('Primer parcial')
    expect(screen.getByLabelText('Materia')).toHaveValue('algebra')
    expect(screen.getByLabelText('Fecha')).toHaveValue('18/11/2026')
    expect(screen.getByLabelText('Hora')).toHaveValue('18:30')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('falls back to the defaults for what it was not given', () => {
    mount({ initialValues: { title: 'TP', kind: null }, defaultKind: 'task' })

    expect(screen.getByRole('dialog', { name: 'Agregar tarea' })).toBeInTheDocument()
    expect(screen.getByLabelText('Materia')).toHaveValue('')
    expect(screen.getByLabelText('Fecha')).toHaveValue('')
  })

  it('saves nothing until the student confirms, then exactly what is shown', async () => {
    const dueAt = dateOnlyDueAt(2026, 11, 18)
    const { onSubmit, user } = mount({
      initialValues: { title: 'Final', kind: 'final', curriculumSubjectId: null, dueAt },
    })

    expect(onSubmit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Final',
      kind: 'final',
      curriculumSubjectId: null,
      dueAt,
    })
  })

  it('is ignored when editing an item', () => {
    mount({
      item: {
        id: 'x',
        curriculumSubjectId: null,
        kind: 'task',
        title: 'Guardado',
        startsAt: null,
        dueAt: null,
        status: 'open',
        notes: null,
      },
      initialValues: { title: 'Del link', kind: 'final' },
    })

    expect(screen.getByRole('textbox', { name: '¿Qué es?' })).toHaveValue('Guardado')
  })
})
