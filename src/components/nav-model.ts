import {
  BookMarked,
  CalendarDays,
  GraduationCap,
  Library,
  NotebookPen,
  Settings,
  Sun,
  type LucideIcon,
} from 'lucide-react'

/**
 * What the app's navigation IS, as data.
 *
 * The desktop sidebar and the mobile tab bar are two renderings of this one
 * list. They used to be a list and a filter of it, which is how three
 * destinations ended up with no way to be reached on a phone: the filter had
 * four slots and nothing said what happened to the rest.
 */

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Gets its own tab on a phone. Everything else lives behind "Más". */
  primary?: boolean
}

export const NAV: NavItem[] = [
  { to: '/today', label: 'Hoy', icon: Sun, primary: true },
  { to: '/plan', label: 'Plan', icon: GraduationCap, primary: true },
  { to: '/courses', label: 'Materias', icon: BookMarked, primary: true },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays, primary: true },
  { to: '/vault', label: 'Vault', icon: NotebookPen },
  { to: '/library', label: 'Material', icon: Library },
  { to: '/settings', label: 'Ajustes', icon: Settings },
]

/** The tabs a phone shows directly. */
export const TAB_ITEMS = NAV.filter((item) => item.primary)

/** Every destination without a tab: two taps away through "Más". */
export const MORE_ITEMS = NAV.filter((item) => !item.primary)

/** Is `to` the section the student is in? Hoy also owns the bare `/`. */
export function isCurrentSection(pathname: string, to: string): boolean {
  return to === '/today'
    ? pathname === '/' || pathname.startsWith('/today')
    : pathname.startsWith(to)
}

/** Is the student somewhere that lives behind "Más"? */
export function isInMore(pathname: string): boolean {
  return MORE_ITEMS.some((item) => isCurrentSection(pathname, item.to))
}

/**
 * Routes where the floating "+" must not appear.
 *
 * A course already has its own "Agregar entrega"; the material page IS an add
 * form; the vault is an editor the button would sit on top of; settings has
 * nothing to add. Everywhere else the button is the thumb's way to capture.
 */
const NO_FLOATING_ADD = [/^\/courses\/[^/]+/, /^\/library/, /^\/vault/, /^\/settings/]

export function showsFloatingAdd(pathname: string): boolean {
  return !NO_FLOATING_ADD.some((pattern) => pattern.test(pathname))
}
