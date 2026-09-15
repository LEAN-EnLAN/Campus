import { Link, useRouterState } from '@tanstack/react-router'
import {
  BookMarked,
  CalendarDays,
  GraduationCap,
  Library,
  Plus,
  Search,
  Settings,
  Sun,
  NotebookPen,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { Button } from './ui/button'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Shown in the mobile bottom bar. Only four fit comfortably at 360px. */
  primary?: boolean
}

const NAV: NavItem[] = [
  { to: '/today', label: 'Hoy', icon: Sun, primary: true },
  { to: '/plan', label: 'Plan', icon: GraduationCap, primary: true },
  { to: '/courses', label: 'Materias', icon: BookMarked, primary: true },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays, primary: true },
  { to: '/vault', label: 'Vault', icon: NotebookPen },
  { to: '/library', label: 'Material', icon: Library },
  { to: '/settings', label: 'Ajustes', icon: Settings },
]

const MOBILE_NAV = NAV.filter((item) => item.primary)

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

  const isCurrent = (to: string) =>
    to === '/today'
      ? pathname === '/' || pathname.startsWith('/today')
      : pathname.startsWith(to)

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
            className="text-ink mb-4 flex items-center gap-2 px-2 font-serif text-lg"
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
                  : 'lg:max-w-measure px-4 pt-5 pb-28 sm:px-6 md:pt-8 lg:px-0 lg:pb-16',
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
                className="lg:w-rail w-full shrink-0 px-4 pb-28 sm:px-6 lg:px-0 lg:pt-8 lg:pb-16"
              >
                {rail}
              </aside>
            ) : null}
          </div>
        </div>
      </div>

      <MobileBottomNav isCurrent={isCurrent} onQuickCapture={onQuickCapture} />
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
  isCurrent,
  onQuickCapture,
}: {
  isCurrent: (to: string) => boolean
  onQuickCapture: () => void
}) {
  return (
    <>
      {/* Quick capture floats above the bar so it stays reachable with a thumb. */}
      <Button
        variant="primary"
        onClick={onQuickCapture}
        aria-label="Agregar entrega"
        className="fixed right-4 bottom-[4.75rem] z-40 size-13 rounded-full shadow-lg md:hidden"
      >
        <Plus aria-hidden="true" className="size-5" />
      </Button>

      {/* A distinct label: two landmarks named the same thing is a real a11y defect. */}
      <nav
        aria-label="Secciones"
        className="border-rule bg-paper-elevated fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {MOBILE_NAV.map((item) => {
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
      </nav>
    </>
  )
}
