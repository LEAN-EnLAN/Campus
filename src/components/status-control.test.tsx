import { act, render, screen, waitFor, within } from '@testing-library/react'
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

async function openChoices() {
  await userEvent.click(
    screen.getByRole('button', { name: /Estado de Álgebra:.*Cambiar estado/ }),
  )
  return screen.getByRole('group', { name: 'Elegir estado de Álgebra' })
}

describe('StatusControl', () => {
  it('uses one visible trigger and SVG Lucide icons instead of five permanent buttons', async () => {
    renderControl()
    const trigger = screen.getByRole('button', { name: /Estado de Álgebra/ })
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(trigger.querySelector('svg')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    const choices = await openChoices()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(within(choices).getAllByRole('button')).toHaveLength(5)
    for (const button of within(choices).getAllByRole('button')) {
      expect(button.querySelector('svg')).toBeInTheDocument()
    }
  })

  it('preserves derived states without writing them as storage values', async () => {
    renderControl('blocked')
    expect(screen.getByRole('button', { name: /Bloqueada/ })).toBeInTheDocument()
    const choices = await openChoices()
    expect(within(choices).getByRole('button', { name: 'Sin marcar' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(choices).queryByRole('button', { name: 'Bloqueada' })).toBeNull()
  })

  it('shows the saved failed state only when present', async () => {
    const { unmount } = renderControl()
    expect(
      within(await openChoices()).queryByRole('button', { name: 'Desaprobada' }),
    ).toBeNull()
    unmount()
    renderControl('failed')
    expect(screen.getByRole('button', { name: /Desaprobada/ })).toBeInTheDocument()
    const choices = await openChoices()
    expect(within(choices).getByRole('button', { name: 'Desaprobada' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('persists the selected state and gives feedback without changing merely on focus', async () => {
    const onChange = vi.fn(() => Promise.resolve())
    renderControl('pending', onChange)
    const choices = await openChoices()
    const approved = within(choices).getByRole('button', { name: 'Aprobada' })
    approved.focus()
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(approved)
    expect(onChange).toHaveBeenCalledWith('passed')
    expect(await screen.findByText('Guardado')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Elegir estado de Álgebra' })).toBeNull()
  })

  it('confirms a save inside the trigger and a live region, never a line that shifts the row', async () => {
    renderControl('pending')
    const trigger = screen.getByRole('button', { name: /Estado de Álgebra/ })
    await userEvent.click(within(await openChoices()).getByRole('button', { name: 'Cursando' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Guardado'))
    expect(screen.getByRole('status')).toHaveClass('sr-only')
    // The trigger still reads as a status, so the row keeps one control height.
    expect(trigger.parentElement?.parentElement?.children).toHaveLength(2)
  })

  it('opens its choices inside the Campus Blue scope so they keep its colours', async () => {
    render(
      <div className="campus-blue" data-testid="scope">
        <StatusControl subjectName="Álgebra" status="pending" onChange={() => undefined} />
      </div>,
    )
    const choices = await openChoices()
    expect(screen.getByTestId('scope')).toContainElement(choices)
  })

  it('uses null to clear and does not re-write the selected state', async () => {
    const onChange = vi.fn(() => Promise.resolve())
    renderControl('passed', onChange)
    await userEvent.click(within(await openChoices()).getByRole('button', { name: 'Aprobada' }))
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(
      within(await openChoices()).getByRole('button', { name: 'Sin marcar' }),
    )
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('reports persistence errors, retains the value, and allows retry', async () => {
    const onChange = vi
      .fn()
      .mockRejectedValueOnce(new Error('No pudimos actualizar la materia'))
      .mockResolvedValue(undefined)
    renderControl('pending', onChange)
    await userEvent.click(within(await openChoices()).getByRole('button', { name: 'Cursando' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos actualizar')
    expect(screen.getByRole('button', { name: /Sin marcar/ })).toBeInTheDocument()
    await userEvent.click(within(await openChoices()).getByRole('button', { name: 'Cursando' }))
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('supports arrow navigation, Home/End, Escape and outside click without writing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn(() => Promise.resolve())
    renderControl('in_progress', onChange)
    const choices = await openChoices()
    expect(within(choices).getByRole('button', { name: 'Cursando' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(within(choices).getByRole('button', { name: 'Regularizada' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(within(choices).getByRole('button', { name: 'Equivalencia' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(within(choices).getByRole('button', { name: 'Sin marcar' })).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Elegir estado de Álgebra' })).toBeNull()
    expect(screen.getByRole('button', { name: /Estado de Álgebra/ })).toHaveFocus()
    await openChoices()
    await user.click(document.body)
    expect(screen.queryByRole('group', { name: 'Elegir estado de Álgebra' })).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('works in compact rows with full accessible labels', async () => {
    renderControl('regularized', undefined, 'compact')
    expect(
      screen.getByRole('button', { name: /Estado de Álgebra: Regularizada/ }),
    ).toBeInTheDocument()
    const choices = await openChoices()
    for (const label of [
      'Sin marcar',
      'Cursando',
      'Regularizada',
      'Aprobada',
      'Equivalencia',
    ]) {
      expect(within(choices).getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('removes transient save feedback after the grace period', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderControl()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByRole('button', { name: /Estado de Álgebra/ }))
      await user.click(screen.getByRole('button', { name: 'Cursando' }))
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
