import { Link, useRouterState } from '@tanstack/react-router'
import { Ellipsis, Plus, Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { CampusLogo } from './brand/campus-logo'

import { AccountMenu, type AccountMenuProps } from './account-menu'
import {
  isCurrentSection,
  isInMore,
  MORE_ITEMS,
  NAV,
  showsFloatingAdd,
  TAB_ITEMS,
  type NavItem,
} from './nav-model'
import { Button } from './ui/button'

/**
 * Routes whose surface is a WORKSPACE, not a document.
 *
 * Every other screen is a column of prose that scrolls the page: capped at a
 * readable measure, centred, padded, growing as tall as its content. A
 * workspace is the opposite contract — it owns the viewport, its own panes do
 * the scrolling, and its header and status bar stay put. Those two contracts
 * need different height rules all the way up the tree: `min-h-dvh` gives the
 * document surface room to grow, and by doing so it denies every descendant a
 * definite height, so an editor inside it can never form a scroll box.
 */
const WORKSPACE_ROUTES = ['/vault', '/calendar']

/**
 * The app shell — navigation, main notebook surface, optional context rail.
 *
 * Desktop: 220px nav · main surface capped at a readable measure · 260px rail.
 * Mobile: content plus a bottom nav and a prominent quick-capture button. Mobile
 * is not a compressed desktop (P-08), so the rail moves inline rather than
 * shrinking.
 */
export function AcademicShell({
  children,
  rail,
  onQuickCapture,
  onSearch,
  academicLabel,
  account,
}: {
  children: ReactNode
  rail?: ReactNode
  onQuickCapture: () => void
  onSearch: () => void
  academicLabel?: string | null
  /** The avatar menu. Tone is the shell's call (navy on mobile, paper on desktop). */
  account?: Omit<AccountMenuProps, 'tone'>
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const isCurrent = (to: string) => isCurrentSection(pathname, to)
  const floatingAdd = showsFloatingAdd(pathname)

  const isWorkspace = WORKSPACE_ROUTES.some((to) => pathname.startsWith(to))

  return (
    <div
      className={cn(
        'campus-blue bg-paper',
        isWorkspace ? 'h-dvh overflow-hidden' : 'min-h-dvh',
      )}
    >
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>

      {/* The 1440 cap is a READING measure, and a workspace is not reading.
          On a 2560px screen it leaves 560px of dead paper down each side while
          the top stays pinned by `h-dvh` — which is why the calendar looked
          like it shrank from three edges and not the fourth. Documents keep the
          cap; the calendar and the vault take the whole window. */}
      <div className={cn('flex w-full', isWorkspace && 'h-full')}>
        {/* ---- Desktop navigation ---- */}
        <nav
          aria-label="Principal"
          className="campus-blue-nav w-nav sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 px-3 py-6 md:flex"
        >
          <Link
            to="/today"
            className="campus-blue-logo mb-8 flex min-h-8 items-center px-2 text-xl"
          >
            <CampusLogo tone="dark" wordmark />
          </Link>

          {NAV.map((item) => (
            <NavLink key={item.to} item={item} current={isCurrent(item.to)} />
          ))}

          {/* Everything down here sits on the navy rail, so it takes the rail's
              hover/focus palette (`campus-blue-nav-*`), never the paper one:
              the ghost Button's `bg-paper-sunken` hover turned "Buscar" into a
              pale slab with near-white text on it. */}
          <div className="mt-auto flex flex-col gap-2 pt-4">
            <p className="campus-blue-institution px-2 text-xs leading-relaxed">
              {academicLabel || 'Tu espacio de estudio'}
              <Link to="/plan" className="campus-blue-institution-link block py-1">
                Ver mi plan académico
              </Link>
            </p>
            <button
              type="button"
              onClick={onSearch}
              className="campus-blue-nav-link campus-blue-nav-idle flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150"
            >
              <Search aria-hidden="true" className="size-5 shrink-0" />
              Buscar
              <kbd className="campus-blue-nav-kbd text-2xs ml-auto">/</kbd>
            </button>
            <Button variant="primary" onClick={onQuickCapture}>
              <Plus aria-hidden="true" />
              Agregar
            </Button>
          </div>
        </nav>

        {/* ---- Main + rail ---- */}
        <div className={cn('flex min-w-0 flex-1 flex-col', isWorkspace && 'min-h-0')}>
          <MobileTopBar onSearch={onSearch} account={account} />

          <DesktopTopBar
            onSearch={onSearch}
            onQuickCapture={onQuickCapture}
            account={account}
          />

          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col',
              isWorkspace ? 'min-h-0 pb-16 md:pb-0' : 'lg:flex-row lg:gap-6 lg:px-7',
            )}
          >
            <main
              id="contenido"
              className={cn(
                'min-w-0 flex-1',
                isWorkspace
                  ? // Full bleed, viewport-bounded: the workspace is the frame.
                    // No measure cap, no page padding, no centring — those are
                    // what left a 189px dead gutter beside the explorer.
                    //
                    // `flex flex-col` is load-bearing, not tidiness. As a block
                    // this passed no definite height to its child, so the
                    // child's `flex-1` did nothing, and a grandchild asking for
                    // `height: 100%` of an auto-height parent went circular —
                    // the calendar measured 33554432px, the browser's ceiling.
                    'flex min-h-0 flex-col overflow-hidden'
                  : cn(
                      'px-4 pt-5 sm:px-6 md:pt-7 lg:px-0 lg:pb-16',
                      // Room for the tab bar, and for the floating "+" only when
                      // there is one: padding for a button that is not there is
                      // dead paper, and a button with no padding covers rows.
                      floatingAdd ? 'pb-36' : 'pb-24',
                    ),
                // With no context rail the reserved 260px would read as dead space
                // on a wide screen, so the notebook surface centres instead.
                !rail && !isWorkspace && 'w-full',
              )}
            >
              {children}
            </main>

            {rail ? (
              <aside
                aria-label="Contexto"
                className={cn(
                  'lg:w-rail w-full shrink-0 px-4 sm:px-6 lg:px-0 lg:pt-8 lg:pb-16',
                  floatingAdd ? 'pb-36' : 'pb-24',
                )}
              >
                {rail}
              </aside>
            ) : null}
          </div>
        </div>
      </div>

      <MobileBottomNav
        pathname={pathname}
        isCurrent={isCurrent}
        floatingAdd={floatingAdd}
        onQuickCapture={onQuickCapture}
      />
    </div>
  )
}

function NavLink({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon

  return (
    <Link
      to={item.to}
      aria-current={current ? 'page' : undefined}
      className={cn(
        // One weight for both states: the filled pill already says "current",
        // and a bolder label would make the word jump in width on navigation.
        'campus-blue-nav-link relative flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
        current ? 'campus-blue-nav-current' : 'campus-blue-nav-idle',
      )}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      {item.label}
    </Link>
  )
}

function DesktopTopBar({
  onSearch,
  onQuickCapture,
  account,
}: {
  onSearch: () => void
  onQuickCapture: () => void
  account?: Omit<AccountMenuProps, 'tone'>
}) {
  return (
    <header className="campus-blue-topbar hidden min-h-19 items-center justify-between gap-5 px-7 md:flex">
      <button
        type="button"
        onClick={onSearch}
        className="campus-blue-search flex min-h-11 w-full max-w-200 items-center gap-3 px-4 text-left text-sm"
        aria-label="Abrir búsqueda global"
      >
        <Search aria-hidden="true" className="size-4" />
        <span className="min-w-0 flex-1 truncate">
          Buscar materias, clases, tareas, fechas…
        </span>
        <kbd className="campus-blue-kbd text-xs">Ctrl + K</kbd>
      </button>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onQuickCapture}
          className="campus-blue-top-action"
          aria-label="Agregar tarea"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
        {account ? <AccountMenu {...account} tone="paper" /> : null}
      </div>
    </header>
  )
}

function MobileTopBar({
  onSearch,
  account,
}: {
  onSearch: () => void
  account?: Omit<AccountMenuProps, 'tone'>
}) {
  return (
    <header className="campus-blue-mobile-top sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 md:hidden">
      <Link to="/today" className="campus-blue-logo -my-2.5 flex items-center py-2.5 text-xl">
        <CampusLogo tone="dark" wordmark />
      </Link>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onSearch}
          aria-label="Buscar"
          className="campus-blue-shell-icon"
        >
          <Search aria-hidden="true" className="size-5" />
        </button>
        {account ? <AccountMenu {...account} tone="shell" /> : null}
      </div>
    </header>
  )
}

function MobileBottomNav({
  pathname,
  isCurrent,
  floatingAdd,
  onQuickCapture,
}: {
  pathname: string
  isCurrent: (to: string) => boolean
  floatingAdd: boolean
  onQuickCapture: () => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)

  // Following a link is the end of the menu; so is leaving the page any other way.
  useEffect(() => setMoreOpen(false), [pathname])

  useEffect(() => {
    if (!moreOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [moreOpen])

  const moreCurrent = isInMore(pathname)

  return (
    <>
      {/* Quick capture floats above the bar so it stays reachable with a thumb.
          Not rendered where the page already has its own add control or where
          it would sit on top of the content (see `showsFloatingAdd`). */}
      {floatingAdd ? (
        <Button
          variant="primary"
          onClick={onQuickCapture}
          aria-label="Agregar entrega"
          className="fixed right-4 bottom-[4.75rem] z-40 size-13 rounded-full shadow-lg md:hidden"
        >
          <Plus aria-hidden="true" className="size-5" />
        </Button>
      ) : null}

      {moreOpen ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cerrar"
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 cursor-default md:hidden"
          />
          <nav
            id="mas-secciones"
            aria-label="Más secciones"
            className="border-rule bg-paper-elevated fixed right-2 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-50 w-56 rounded-lg border p-1 shadow-lg md:hidden"
          >
            <ul>
              {MORE_ITEMS.map((item) => (
                <li key={item.to}>
                  <MoreLink item={item} current={isCurrent(item.to)} />
                </li>
              ))}
            </ul>
          </nav>
        </>
      ) : null}

      {/* A distinct label: two landmarks named the same thing is a real a11y defect. */}
      <nav
        aria-label="Secciones"
        className="border-rule bg-paper-elevated fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon
          const current = isCurrent(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'text-2xs flex min-h-14 flex-col items-center justify-center gap-1 transition-colors',
                current ? 'text-accent-ink' : 'text-ink-muted',
              )}
            >
              <Icon aria-hidden="true" className="size-5" />
              {item.label}
            </Link>
          )
        })}

        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="mas-secciones"
          aria-current={moreCurrent ? 'page' : undefined}
          onClick={() => setMoreOpen((open) => !open)}
          className={cn(
            'text-2xs flex min-h-14 flex-col items-center justify-center gap-1 transition-colors',
            moreCurrent || moreOpen ? 'text-accent-ink' : 'text-ink-muted',
          )}
        >
          <Ellipsis aria-hidden="true" className="size-5" />
          Más
        </button>
      </nav>
    </>
  )
}

function MoreLink({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors',
        current
          ? 'bg-accent-soft text-accent-ink font-medium'
          : 'text-ink hover:bg-paper-sunken',
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {item.label}
    </Link>
  )
}
