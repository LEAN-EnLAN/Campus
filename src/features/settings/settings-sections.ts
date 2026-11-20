import {
  CircleUserRound,
  FileDown,
  FolderOpen,
  GraduationCap,
  Palette,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

/**
 * Ajustes' URL contract: `/settings?seccion=apariencia` opens one section.
 * Anything that is not a known section is dropped, so the screen falls back to
 * its default instead of guessing.
 */
export const SETTINGS_SECTIONS = [
  'carrera',
  'apariencia',
  'asistente',
  'espacio',
  'privacidad',
  'datos',
  'cuenta',
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

/** What a wide screen shows when the URL names no section. */
export const DEFAULT_SETTINGS_SECTION: SettingsSection = 'carrera'

export interface SettingsSearch {
  seccion?: SettingsSection
}

function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string' && (SETTINGS_SECTIONS as readonly string[]).includes(value)
}

export function parseSettingsSearch(search: Record<string, unknown>): SettingsSearch {
  return isSettingsSection(search.seccion) ? { seccion: search.seccion } : {}
}

/**
 * The old one-page Ajustes was addressed by anchors (`/settings#asistente`,
 * `#settings-export`). Bookmarks and links that still carry one land on the
 * section that now holds that content.
 */
const LEGACY_ANCHORS: Record<string, SettingsSection> = {
  asistente: 'asistente',
  'settings-assistant': 'asistente',
  'settings-academic': 'carrera',
  'settings-appearance': 'apariencia',
  'settings-workspace': 'espacio',
  'settings-privacy': 'privacidad',
  'settings-export': 'datos',
  'settings-account': 'cuenta',
  'settings-delete-account': 'cuenta',
}

export function sectionFromLegacyHash(hash: string): SettingsSection | null {
  return LEGACY_ANCHORS[hash.replace(/^#/, '')] ?? null
}

export interface SettingsNavItem {
  id: SettingsSection
  label: string
  icon: LucideIcon
}

export interface SettingsNavGroup {
  label: string
  items: readonly SettingsNavItem[]
}

export const SETTINGS_NAV: readonly SettingsNavGroup[] = [
  {
    label: 'Tu cursada',
    items: [
      { id: 'carrera', label: 'Carrera', icon: GraduationCap },
      { id: 'apariencia', label: 'Apariencia', icon: Palette },
      { id: 'asistente', label: 'Asistente', icon: Sparkles },
    ],
  },
  {
    label: 'Cuenta',
    items: [
      { id: 'espacio', label: 'Espacio de trabajo', icon: FolderOpen },
      { id: 'privacidad', label: 'Privacidad', icon: ShieldCheck },
      { id: 'datos', label: 'Tus datos', icon: FileDown },
      { id: 'cuenta', label: 'Cuenta', icon: CircleUserRound },
    ],
  },
]

/**
 * The navigation for this session: the account section only exists where
 * there is an account (Local has none).
 */
export function settingsNav({ hasAccount }: { hasAccount: boolean }): SettingsNavGroup[] {
  return SETTINGS_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.id !== 'cuenta' || hasAccount),
  }))
}

/**
 * Which section to show. A section the session does not offer (Cuenta on Local)
 * falls back to the default rather than rendering an empty page.
 */
export function resolveSettingsSection(
  requested: SettingsSection | undefined,
  nav: readonly SettingsNavGroup[],
): SettingsSection {
  const available = nav.flatMap((group) => group.items.map((item) => item.id))
  return requested && available.includes(requested) ? requested : DEFAULT_SETTINGS_SECTION
}
