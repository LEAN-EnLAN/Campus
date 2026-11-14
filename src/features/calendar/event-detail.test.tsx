import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { AcademicItem } from '@/domain/types'

import { EventDetail, EventDetailDialog } from './campus-calendar'
import { openableChip } from './openable-chip'

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

// QA: the floating panel ran past the viewport (Editar/Eliminar out of reach),
// and only a double click opened it. The detail is now a dialog, opened by one
// click — or by Enter/Space on the focused chip.
describe('the calendar event dialog', () => {
  function mountDialog(isOpen = true) {
    const onClose = vi.fn()
    render(
      <EventDetailDialog
        args={
          { event: { meta: { item: parcial } }, isOpen, onClose } as unknown as ComponentProps<
            typeof EventDetailDialog
          >['args']
        }
        subjectName={() => null}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    return { onClose, user: userEvent.setup() }
  }

  it('is a modal dialog named after the item, with every action inside it', () => {
    mountDialog()

    const dialog = screen.getByRole('dialog', { name: 'Parcial 1' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    // Bounded by the viewport and scrolling inside, never past its edge.
    expect(dialog.className).toMatch(/max-h-/)
    expect(dialog.className).toMatch(/overflow-y-auto/)
    expect(within(dialog).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('closes with Escape', async () => {
    const { onClose, user } = mountDialog()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing while closed', () => {
    mountDialog(false)

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('a calendar chip', () => {
  it('is a focusable button that Enter and Space click, like a pointer would', async () => {
    const onEventBoxClick = vi.fn()
    render(
      // The vendor's event box listens for the click that bubbles out of our chip.
      <div onClick={onEventBoxClick}>
        <span {...openableChip}>Parcial 1</span>
      </div>,
    )
    const user = userEvent.setup()
    const chip = screen.getByRole('button', { name: 'Parcial 1' })
    expect(chip).toHaveAttribute('aria-haspopup', 'dialog')

    await user.tab()
    expect(chip).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onEventBoxClick).toHaveBeenCalledTimes(2)
  })
})
