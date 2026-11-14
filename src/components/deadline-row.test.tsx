import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AcademicItem } from '@/domain/types'

import { DeadlineRow } from './deadline-row'

const item: AcademicItem = {
  id: 'p1',
  curriculumSubjectId: null,
  kind: 'midterm',
  title: 'Parcial SO editado 1794627566315',
  startsAt: null,
  dueAt: new Date(2026, 10, 22, 18, 30).toISOString(),
  status: 'open',
  notes: null,
}

function mount() {
  return render(
    <DeadlineRow
      item={item}
      onToggle={vi.fn()}
      onShare={vi.fn()}
      onDownloadIcs={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
}

describe('DeadlineRow', () => {
  it('names every action after the item', () => {
    mount()

    for (const name of [
      'Marcar Parcial SO editado 1794627566315 como hecho',
      'Copiar Parcial SO editado 1794627566315 para WhatsApp',
      'Descargar .ics de Parcial SO editado 1794627566315',
      'Editar Parcial SO editado 1794627566315',
      'Eliminar Parcial SO editado 1794627566315',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  // QA at 360px: checkbox + time + title + four buttons on one unwrapping line
  // pushed /today to 414px wide. jsdom has no layout, so this pins the rules
  // that let it wrap; the 360px browser sweep is what proves the result.
  it('lets a narrow row wrap: the actions take their own line, long tokens break', () => {
    const { container } = mount()

    const row = container.firstElementChild as HTMLElement
    expect(row).toHaveClass('@container')
    expect(row.firstElementChild).toHaveClass('flex-wrap')

    const actions = screen.getByRole('button', {
      name: 'Editar Parcial SO editado 1794627566315',
    }).parentElement
    expect(actions).toHaveClass('@max-md:basis-full')

    expect(screen.getByText('Parcial SO editado 1794627566315')).toHaveClass('wrap-anywhere')
  })
})
