import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { AcademicItem } from '@/domain/types'

import { EventDetail } from './campus-calendar'

const parcial: AcademicItem = {
  id: 'p1',
  curriculumSubjectId: null,
  kind: 'midterm',
  title: 'Parcial 1',
  startsAt: null,
  dueAt: new Date(2026, 9, 23, 18, 30).toISOString(),
  status: 'open',
  notes: null,
}

function mount() {
  const props = {
    args: { event: { meta: { item: parcial } }, onClose: vi.fn() } as unknown as ComponentProps<
      typeof EventDetail
    >['args'],
    subjectName: () => null,
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
  render(<EventDetail {...props} />)
  return { ...props, user: userEvent.setup() }
}

describe('the calendar event popover', () => {
  it('still marks the item done', async () => {
    const { user, onToggle } = mount()

    await user.click(screen.getByRole('button', { name: 'Marcar como hecho' }))
    expect(onToggle).toHaveBeenCalledWith(parcial, true)
  })

  it('closes itself and opens the edit dialog on "Editar"', async () => {
    const { user, onEdit, args } = mount()

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(args.onClose).toHaveBeenCalled()
    expect(onEdit).toHaveBeenCalledWith(parcial)
  })

  it('closes itself and asks to confirm on "Eliminar"', async () => {
    const { user, onDelete, args } = mount()

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(args.onClose).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalledWith(parcial)
  })
})
