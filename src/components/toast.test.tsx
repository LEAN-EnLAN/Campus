import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider, useToast } from './toast'

function Trigger({ onUndo }: { onUndo?: () => void }) {
  const toast = useToast()
  return (
    <button
      onClick={() =>
        toast.show({
          message: 'Hecho',
          action: onUndo ? { label: 'Deshacer', onAction: onUndo } : undefined,
        })
      }
    >
      mostrar
    </button>
  )
}

const mount = (onUndo?: () => void) =>
  render(
    <ToastProvider>
      <Trigger onUndo={onUndo} />
    </ToastProvider>,
  )

afterEach(() => vi.useRealTimers())

describe('toast', () => {
  it('announces its message politely, without taking focus', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(screen.getByRole('button', { name: 'mostrar' }))

    expect(screen.getByRole('status')).toHaveTextContent('Hecho')
  })

  it('runs the action once and goes away', async () => {
    const user = userEvent.setup()
    const undo = vi.fn()
    mount(undo)

    await user.click(screen.getByRole('button', { name: 'mostrar' }))
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))

    expect(undo).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull()
  })

  it('disappears on its own', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mount()

    act(() => screen.getByRole('button', { name: 'mostrar' }).click())
    expect(screen.getByRole('status')).toHaveTextContent('Hecho')

    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(screen.getByRole('status')).not.toHaveTextContent('Hecho')
  })
})
