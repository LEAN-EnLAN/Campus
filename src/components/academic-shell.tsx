import { Link, useRouterState } from '@tanstack/react-router'
import { Bell, BookOpen, ChevronDown, Ellipsis, Plus, Search } from 'lucide-react'
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
import '../styles/campus-blue.css'

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
            className="campus-blue-logo mb-8 flex min-h-8 items-center gap-3 px-2 font-serif text-xl"
          >
            <BookOpen aria-hidden="true" className="size-6 fill-blue-300/30 text-blue-300" />
            Campus
          </Link>

          {NAV.map((item) => (
            <NavLink key={item.to} item={item} current={isCurrent(item.to)} />
          ))}

          <div className="campus-blue-nav-footer mt-auto flex flex-col gap-2 pt-4">
            <p className="campus-blue-institution px-2 text-xs leading-relaxed">
              UTN Facultad Regional Rosario
              <span className="block">Ingeniería en Sistemas</span>
              <span className="block">Plan académico</span>
            </p>
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

          <DesktopTopBar onSearch={onSearch} onQuickCapture={onQuickCapture} />

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
                      'campus-blue-main px-4 pt-5 sm:px-6 md:pt-7 lg:px-0 lg:pb-16',
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
        'campus-blue-nav-link relative flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
        current ? 'campus-blue-nav-current font-semibold' : 'campus-blue-nav-idle',
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
}: {
  onSearch: () => void
  onQuickCapture: () => void
}) {
  return (
    <header className="campus-blue-topbar hidden min-h-19 items-center justify-between gap-5 px-7 md:flex">
      <button
        type="button"
        onClick={onSearch}
        className="campus-blue-search flex min-h-11 w-full max-w-[800px] items-center gap-3 px-4 text-left text-sm"
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
        <Link
          to="/settings"
          className="campus-blue-top-action"
          aria-label="Configurar notificaciones"
        >
          <Bell className="size-5" aria-hidden="true" />
        </Link>
        <Link
          to="/settings"
          className="campus-blue-avatar"
          aria-label="Abrir ajustes de cuenta"
        >
          C <ChevronDown aria-hidden="true" className="ml-1 size-3" />
        </Link>
      </div>
    </header>
  )
}

function MobileTopBar({ onSearch }: { onSearch: () => void }) {
  return (
    <header className="campus-blue-mobile-top sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 md:hidden">
      <Link
        to="/today"
        className="-my-2.5 flex items-center gap-2 py-2.5 font-serif text-xl text-white"
      >
        <BookOpen aria-hidden="true" className="size-5 text-blue-300" />
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
