import { ArrowLeftRight, Cloud, FolderOpen, Laptop, LogOut, MessageSquare } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

import { Illustration } from './ui/illustration'

/** Who/where the student is. Local has no account: the identity IS the folder. */
export type AccountIdentity =
  { kind: 'cloud'; email: string | null } | { kind: 'local'; folderName: string }

export interface AccountMenuProps {
  identity: AccountIdentity
  onChangeWorkspace: () => void
  /** "Contanos algo". Absent when this workspace has no way to reach the team. */
  onFeedback?: () => void
  /** Only when there is a session to end. Absent in Local: there is no account. */
  onSignOut?: () => void
  signingOut?: boolean
  /** `shell` sits on the navy mobile bar; `paper` on the white desktop top bar. */
  tone?: 'paper' | 'shell'
}

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return Array.from(
    menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
  )
}

function initialOf(text: string | null): string | null {
  const first = text?.trim().charAt(0) ?? ''
  return /\p{L}/u.test(first) ? first.toLocaleUpperCase('es-AR') : null
}

/**
 * Account and workspace menu — the avatar in the top bar.
 *
 * It answers "who am I signed in as / which folder is open" and holds the two
 * session-level actions (switch workspace, sign out). It deliberately has no
 * "Ajustes" item: Settings is already in the navigation.
 *
 * WAI-ARIA menu button: the trigger has `aria-haspopup="menu"` and
 * `aria-expanded`; Enter/Space/↓ open on the first item, ↑ on the last; inside,
 * ↑/↓ wrap, Home/End jump, Escape closes and returns focus, Tab closes and lets
 * focus move on. The identity block sits outside `role="menu"` (a menu may only
 * own items) and names the menu through `aria-labelledby`.
 */
export function AccountMenu({
  identity,
  onChangeWorkspace,
  onFeedback,
  onSignOut,
  signingOut = false,
  tone = 'paper',
}: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const openOn = useRef<'first' | 'last'>('first')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const menuId = `${baseId}-menu`
  const identityId = `${baseId}-identity`

  const isLocal = identity.kind === 'local'
  const name = isLocal ? identity.folderName : (identity.email ?? 'Cuenta de Campus Cloud')
  const initial = isLocal ? null : initialOf(identity.email)
  const ModeIcon = isLocal ? FolderOpen : Cloud

  useEffect(() => {
    if (!open) return
    const list = menuItems(menuRef.current)
    ;(openOn.current === 'last' ? list.at(-1) : list[0])?.focus()

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function show(at: 'first' | 'last') {
    openOn.current = at
    setOpen(true)
  }

  function close({ restoreFocus }: { restoreFocus: boolean }) {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      show(event.key === 'ArrowUp' ? 'last' : 'first')
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = menuItems(menuRef.current)
    const index = list.indexOf(document.activeElement as HTMLElement)
    const move = (next: number) => {
      event.preventDefault()
      list[(next + list.length) % list.length]?.focus()
    }
    switch (event.key) {
      case 'ArrowDown':
        return move(index + 1)
      case 'ArrowUp':
        return move(index - 1)
      case 'Home':
        return move(0)
      case 'End':
        return move(list.length - 1)
      case 'Escape':
        event.preventDefault()
        return close({ restoreFocus: true })
      case 'Tab':
        return setOpen(false)
    }
  }

  function select(action: () => void) {
    close({ restoreFocus: true })
    action()
  }

  return (
    <div ref={rootRef} className="campus-account" data-tone={tone}>
      <button
        ref={triggerRef}
        type="button"
        data-account-menu
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={isLocal ? `Espacio de trabajo: ${name}` : `Cuenta: ${name}`}
        onClick={() => (open ? close({ restoreFocus: false }) : show('first'))}
        onKeyDown={onTriggerKeyDown}
        className="campus-account-trigger"
      >
        <span className="campus-account-avatar" aria-hidden="true">
          {initial ?? <Laptop className="size-4" />}
        </span>
      </button>

      {open ? (
        <div className="campus-account-popover">
          <div id={identityId} className="campus-account-identity">
            {/* Where the work lives, drawn: the name and the mode beside it say it in words. */}
            <Illustration
              name={isLocal ? 'account-local' : 'account-cloud'}
              decorative
              size="icon"
              className="w-16"
            />
            <span className="min-w-0">
              <span className="campus-account-name">{name}</span>
              <span className="campus-account-detail">
                <span className="campus-account-mode">
                  <ModeIcon aria-hidden="true" className="size-3.5" />
                  {isLocal ? 'Local' : 'Cloud'}
                </span>
                {isLocal ? 'Sin cuenta' : null}
              </span>
            </span>
          </div>

          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={identityId}
            onKeyDown={onMenuKeyDown}
          >
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="campus-account-item"
              onClick={() => select(onChangeWorkspace)}
            >
              <ArrowLeftRight aria-hidden="true" className="size-4" />
              Cambiar de espacio de trabajo
            </button>
            {onFeedback ? (
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="campus-account-item"
                onClick={() => select(onFeedback)}
              >
                <MessageSquare aria-hidden="true" className="size-4" />
                Contanos algo
              </button>
            ) : null}
            {onSignOut ? (
              <>
                <div role="separator" className="campus-account-separator" />
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={signingOut}
                  className="campus-account-item"
                  onClick={() => select(onSignOut)}
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
