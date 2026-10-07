import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { SubjectStatus } from '@/domain/types'

import { StatusControl } from './status-control'

const renderControl = (
  status: SubjectStatus = 'pending',
  onChange: (value: unknown) => Promise<unknown> | void = () => Promise.resolve(),
  variant: 'full' | 'compact' = 'full',
) =>
  render(
    <StatusControl
      subjectName="Álgebra"
      status={status}
      onChange={onChange}
      variant={variant}
    />,
  )

const group = () => screen.getByRole('group', { name: 'Estado de Álgebra' })

describe('StatusControl', () => {
  it('offers the five states in order, each a button', () => {
    renderControl()
    const names = screen.getAllByRole('button').map((b) => b.textContent)
    expect(names.map((n) => n?.replace(/^\S\s?/, '').trim())).toEqual([
      'Sin marcar',
      'Cursando',
      'Regularizada',
      'Aprobada',
      'Equivalencia',
    ])
  })

  it('presses the current status; derived statuses read as "Sin marcar"', () => {
    renderControl('available')
    expect(screen.getByRole('button', { name: /Sin marcar/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Aprobada/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('shows Desaprobada, only when that is the stored state, so it is never hidden', () => {
    const { unmount } = renderControl('pending')
    expect(screen.queryByRole('button', { name: /Desaprobada/ })).toBeNull()
    unmount()
    renderControl('failed')
    expect(screen.getByRole('button', { name: /Desaprobada/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('saves on one click and tells the student, briefly', async () => {
    const onChange = vi.fn(() => Promise.resolve())
    renderControl('pending', onChange)
    await userEvent.click(screen.getByRole('button', { name: /Aprobada/ }))

    expect(onChange).toHaveBeenCalledWith('passed')
    expect(await screen.findByText('Guardado')).toBeInTheDocument()
  })

  it('maps "Sin marcar" to a clear, not to a placeholder status', async () => {
    const onChange = vi.fn(() => Promise.resolve())
    renderControl('passed', onChange)
    await userEvent.click(screen.getByRole('button', { name: /Sin marcar/ }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('does not write again when the pressed option is clicked', async () => {
    const onChange = vi.fn(() => Promise.resolve())
    renderControl('passed', onChange)
    await userEvent.click(screen.getByRole('button', { name: /Aprobada/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("says why when saving fails, in the student's words", async () => {
    renderControl('pending', () =>
      Promise.reject(new Error('No pudimos actualizar la materia: x')),
    )
    await userEvent.click(screen.getByRole('button', { name: /Cursando/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos actualizar la materia',
    )
  })

  it('keeps one tab stop per row, on the pressed option', () => {
    renderControl('in_progress')
    const stops = screen.getAllByRole('button').filter((b) => b.tabIndex === 0)
    expect(stops).toHaveLength(1)
    expect(stops[0]).toHaveTextContent('Cursando')
  })

  it('moves focus with the arrows (wrapping) without saving; Enter saves', async () => {
    const onChange = vi.fn(() => Promise.resolve())
    renderControl('pending', onChange)
    const user = userEvent.setup()

    screen.getByRole('button', { name: /Sin marcar/ }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: /Cursando/ })).toHaveFocus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('button', { name: /Aprobada/ })).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()

    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('passed')

    await user.keyboard('{End}')
    expect(screen.getByRole('button', { name: /Equivalencia/ })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: /Sin marcar/ })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('button', { name: /Equivalencia/ })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('button', { name: /Sin marcar/ })).toHaveFocus()
  })

  it('names every option for a screen reader in the compact variant, where only icons show', () => {
    renderControl('pending', undefined, 'compact')
    for (const label of [
      'Sin marcar',
      'Cursando',
      'Regularizada',
      'Aprobada',
      'Equivalencia',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(group()).toBeInTheDocument()
  })

  it('forgets the "Guardado" note after a moment', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderControl('pending')
      await userEvent
        .setup({ advanceTimers: vi.advanceTimersByTime })
        .click(screen.getByRole('button', { name: /Cursando/ }))
      expect(await screen.findByText('Guardado')).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500)
      })
      await waitFor(() => expect(screen.queryByText('Guardado')).toBeNull())
    } finally {
      vi.useRealTimers()
    }
  })
})
