import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FinalOutcomeDialog } from './final-outcome-dialog'

function mount(subjectName: string | null = 'Análisis II') {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <FinalOutcomeDialog
      open
      title="Final de Análisis II"
      subjectName={subjectName}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  )
  return { onConfirm, onClose, user: userEvent.setup() }
}

describe('FinalOutcomeDialog', () => {
  it('asks how it went, with the three outcomes', () => {
    mount()

    expect(
      screen.getByRole('dialog', { name: '¿Cómo te fue en Final de Análisis II?' }),
    ).toBeInTheDocument()
    for (const name of ['Aprobé', 'Desaprobé', 'Ausente']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument()
    }
  })

  it('does not decide for the student: nothing is chosen until they choose', async () => {
    const { user, onConfirm } = mount()

    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByText('Elegí cómo te fue.')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('offers to mark the subject Aprobada, with an optional nota', async () => {
    const { user, onConfirm } = mount()

    await user.click(screen.getByRole('radio', { name: 'Aprobé' }))
    expect(
      screen.getByRole('checkbox', { name: 'Marcar Análisis II como Aprobada' }),
    ).toBeChecked()
    await user.type(screen.getByLabelText('Nota (opcional)'), '8')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onConfirm).toHaveBeenCalledWith({ outcome: 'passed', updateSubject: true, grade: 8 })
  })

  it('lets the student decline the state update', async () => {
    const { user, onConfirm } = mount()

    await user.click(screen.getByRole('radio', { name: 'Aprobé' }))
    await user.click(screen.getByRole('checkbox', { name: 'Marcar Análisis II como Aprobada' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onConfirm).toHaveBeenCalledWith({
      outcome: 'passed',
      updateSubject: false,
      grade: null,
    })
  })

  it('offers Desaprobada for a failed final', async () => {
    const { user, onConfirm } = mount()

    await user.click(screen.getByRole('radio', { name: 'Desaprobé' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onConfirm).toHaveBeenCalledWith({
      outcome: 'failed',
      updateSubject: true,
      grade: null,
    })
  })

  it('an absence changes no subject state', async () => {
    const { user, onConfirm } = mount()

    await user.click(screen.getByRole('radio', { name: 'Ausente' }))
    expect(screen.queryByRole('checkbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onConfirm).toHaveBeenCalledWith({
      outcome: 'absent',
      updateSubject: false,
      grade: null,
    })
  })

  it('has no state to offer when the final has no subject', async () => {
    const { user, onConfirm } = mount(null)

    await user.click(screen.getByRole('radio', { name: 'Aprobé' }))
    expect(screen.queryByRole('checkbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onConfirm).toHaveBeenCalledWith({
      outcome: 'passed',
      updateSubject: false,
      grade: null,
    })
  })

  it('rejects a nota outside 1–10, inline', async () => {
    const { user, onConfirm } = mount()

    await user.click(screen.getByRole('radio', { name: 'Aprobé' }))
    await user.type(screen.getByLabelText('Nota (opcional)'), '15')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByText('La nota va de 1 a 10.')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('closes without changing anything on Cancelar', async () => {
    const { user, onClose, onConfirm } = mount()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
