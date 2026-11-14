import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AccountMenu, type AccountIdentity } from './account-menu'

const local: AccountIdentity = { kind: 'local', folderName: 'Facultad' }
const cloud: AccountIdentity = { kind: 'cloud', email: 'ana@example.com' }

describe('AccountMenu', () => {
  it('is a menu button, not a second link to Settings', async () => {
    render(<AccountMenu identity={local} onChangeWorkspace={() => {}} />)
    const trigger = screen.getByRole('button', { name: 'Espacio de trabajo: Facultad' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu')
    expect(trigger).toHaveAttribute('aria-controls', menu.id)
    expect(screen.queryByRole('menuitem', { name: /ajustes/i })).not.toBeInTheDocument()
  })

  it('in Local names the folder, says there is no account, and offers no sign-out', async () => {
    render(<AccountMenu identity={local} onChangeWorkspace={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /Espacio de trabajo/ }))
    const menu = screen.getByRole('menu')
    expect(menu).toHaveAccessibleName(/Facultad.*Local.*Sin cuenta/)
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Cambiar de espacio de trabajo',
    ])
  })

  it('in Cloud shows the email and signs out', async () => {
    const onSignOut = vi.fn()
    render(<AccountMenu identity={cloud} onChangeWorkspace={() => {}} onSignOut={onSignOut} />)
    const trigger = screen.getByRole('button', { name: 'Cuenta: ana@example.com' })
    expect(trigger).toHaveTextContent('A')
    await userEvent.click(trigger)
    expect(screen.getByRole('menu')).toHaveAccessibleName(/ana@example\.com.*Cloud/)
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('offers "Contanos algo" only when there is a way to send it', async () => {
    const onFeedback = vi.fn()
    const { unmount } = render(
      <AccountMenu identity={cloud} onChangeWorkspace={() => {}} onFeedback={onFeedback} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Cuenta/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Contanos algo' }))
    expect(onFeedback).toHaveBeenCalledTimes(1)
    unmount()

    render(<AccountMenu identity={cloud} onChangeWorkspace={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /Cuenta/ }))
    expect(screen.queryByRole('menuitem', { name: 'Contanos algo' })).toBeNull()
  })

  it('follows the menu-button keyboard contract', async () => {
    const onChangeWorkspace = vi.fn()
    render(
      <AccountMenu
        identity={cloud}
        onChangeWorkspace={onChangeWorkspace}
        onSignOut={() => {}}
      />,
    )
    const trigger = screen.getByRole('button', { name: /Cuenta/ })
    trigger.focus()

    await userEvent.keyboard('{ArrowDown}')
    const [change, signOut] = screen.getAllByRole('menuitem')
    expect(change).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(signOut).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(change).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(signOut).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(change).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getAllByRole('menuitem').at(-1)).toHaveFocus()
    await userEvent.keyboard('{Home}{Enter}')
    expect(onChangeWorkspace).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveFocus()
  })

  it('closes on a pointer press outside', async () => {
    render(
      <>
        <AccountMenu identity={local} onChangeWorkspace={() => {}} />
        <p>afuera</p>
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: /Espacio de trabajo/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.click(screen.getByText('afuera'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
