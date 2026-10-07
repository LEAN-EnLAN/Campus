import { Link, useRouterState } from '@tanstack/react-router'
import { Ellipsis, Plus, Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

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
}: {
  children: ReactNode
  rail?: ReactNode
  onQuickCapture: () => void
  onSearch: () => void
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const isCurrent = (to: string) => isCurrentSection(pathname, to)
  const floatingAdd = showsFloatingAdd(pathname)

  const isWorkspace = WORKSPACE_ROUTES.some((to) => pathname.startsWith(to))

  return (
    <div className={cn('bg-paper', isWorkspace ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>

      {/* The 1440 cap is a READING measure, and a workspace is not reading.
          On a 2560px screen it leaves 560px of dead paper down each side while
          the top stays pinned by `h-dvh` — which is why the calendar looked
          like it shrank from three edges and not the fourth. Documents keep the
          cap; the calendar and the vault take the whole window. */}
      <div className={cn('flex w-full', isWorkspace ? 'h-full' : 'mx-auto max-w-[1440px]')}>
        {/* ---- Desktop navigation ---- */}
        <nav
          aria-label="Principal"
          className="w-nav border-rule sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 border-r px-3 py-5 md:flex"
        >
          <Link
            to="/today"
            className="text-ink mb-4 flex min-h-8 items-center gap-2 px-2 font-serif text-lg"
          >
            <span aria-hidden="true" className="bg-accent inline-block h-5 w-1 rounded-full" />
            Campus
          </Link>

          {NAV.map((item) => (
            <NavLink key={item.to} item={item} current={isCurrent(item.to)} />
          ))}

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <Button
              variant="ghost"
              onClick={onSearch}
              className="text-ink-muted justify-start gap-2 px-2"
            >
              <Search aria-hidden="true" />
              Buscar
              <kbd className="border-rule text-2xs text-ink-muted ml-auto rounded border px-1">
                /
              </kbd>
            </Button>
            <Button variant="primary" onClick={onQuickCapture} className="gap-2">
              <Plus aria-hidden="true" />
              Agregar
            </Button>
          </div>
        </nav>

        {/* ---- Main + rail ---- */}
        <div className={cn('flex min-w-0 flex-1 flex-col', isWorkspace && 'min-h-0')}>
          <MobileTopBar onSearch={onSearch} />

          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col',
              isWorkspace ? 'min-h-0 pb-16 md:pb-0' : 'lg:flex-row lg:gap-8 lg:px-8',
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
                      'lg:max-w-measure px-4 pt-5 sm:px-6 md:pt-8 lg:px-0 lg:pb-16',
                      // Room for the tab bar, and for the floating "+" only when
                      // there is one: padding for a button that is not there is
                      // dead paper, and a button with no padding covers rows.
                      floatingAdd ? 'pb-36' : 'pb-24',
                    ),
                // With no context rail the reserved 260px would read as dead space
                // on a wide screen, so the notebook surface centres instead.
                !rail && !isWorkspace && 'lg:mx-auto',
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
        'relative flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors duration-150',
        current
          ? 'bg-accent-soft text-accent-ink font-medium'
          : 'text-ink-muted hover:bg-paper-sunken hover:text-ink',
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {item.label}
    </Link>
  )
}

function MobileTopBar({ onSearch }: { onSearch: () => void }) {
  return (
    <header className="border-rule bg-paper/90 sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-sm md:hidden">
      <Link
        to="/today"
        className="text-ink -my-2.5 flex items-center gap-2 py-2.5 font-serif text-base"
      >
        <span aria-hidden="true" className="bg-accent inline-block h-4 w-1 rounded-full" />
        Campus
      </Link>
      <Button variant="ghost" size="icon-touch" onClick={onSearch} aria-label="Buscar">
        <Search aria-hidden="true" />
      </Button>
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
