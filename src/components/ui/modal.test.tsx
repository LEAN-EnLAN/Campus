import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Modal, ModalFooter } from './modal'
import { tabbables } from './tabbable'

function Radios() {
  return (
    <fieldset>
      <legend>Kind</legend>
      <label>
        <input type="radio" name="kind" value="a" className="sr-only" /> A
      </label>
      <label>
        <input type="radio" name="kind" value="b" className="sr-only" defaultChecked /> B
      </label>
      <label>
        <input type="radio" name="kind" value="c" className="sr-only" /> C
      </label>
    </fieldset>
  )
}

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  return (
    <Modal open onClose={onClose} labelledBy="t">
      <h2 id="t">Title</h2>
      <input aria-label="first" />
      <Radios />
      <ModalFooter>
        <button type="button">Cancel</button>
        <button type="button">Save</button>
      </ModalFooter>
    </Modal>
  )
}

describe('tabbables', () => {
  it('counts a radio group once, on the checked radio', () => {
    const { container } = render(<Radios />)
    const stops = tabbables(container)
    expect(stops).toHaveLength(1)
    expect((stops[0] as HTMLInputElement).value).toBe('b')
  })

  it('falls back to the first radio when none is checked', () => {
    const { container } = render(
      <div>
        <input type="radio" name="g" value="x" />
        <input type="radio" name="g" value="y" />
      </div>,
    )
    expect((tabbables(container)[0] as HTMLInputElement).value).toBe('x')
  })

  it('skips disabled, hidden and tabindex=-1 controls', () => {
    const { container } = render(
      <div>
        <button disabled>no</button>
        <button hidden>no</button>
        <div style={{ display: 'none' }}>
          <button>no</button>
        </div>
        <button tabIndex={-1}>no</button>
        <button>yes</button>
      </div>,
    )
    expect(tabbables(container).map((el) => el.textContent)).toEqual(['yes'])
  })
})

describe('Modal', () => {
  it('has a dialog role and no close button outside it', () => {
    render(<Harness />)
    expect(screen.getByRole('dialog', { name: 'Title' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull()
  })

  it('closes on the pointer-only backdrop and on Escape', async () => {
    const onClose = vi.fn()
    const { container } = render(<Harness onClose={onClose} />)
    fireEvent.click(container.querySelector('[aria-hidden="true"]')!)
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('wraps Tab from the last real control to the first, ignoring sibling radios', async () => {
    render(<Harness />)
    const first = screen.getByLabelText('first')
    await waitFor(() => expect(first).toHaveFocus()) // the open-time focus lands first
    const save = screen.getByRole('button', { name: 'Save' })
    save.focus()
    await userEvent.tab()
    expect(first).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(save).toHaveFocus()
  })
})
