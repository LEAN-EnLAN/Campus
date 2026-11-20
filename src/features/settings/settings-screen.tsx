import { Link, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, type ComponentType } from 'react'

import { AssistantSettingsSection } from '@/features/assistant/assistant-settings'
import { useBackend } from '@/lib/backends/context'
import { useRequiresAccount } from '@/lib/runtime/identity'
import { cn } from '@/lib/utils'

import { AccountSection } from './account-section'
import { AppearanceSection } from './appearance-section'
import { CareerSection } from './career-section'
import { ExportSection } from './export-section'
import { PrivacySection } from './privacy-section'
import {
  parseSettingsSearch,
  resolveSettingsSection,
  settingsNav,
  type SettingsNavGroup,
  type SettingsSection,
} from './settings-sections'
import { WorkspaceSection } from './workspace-section'

const SECTIONS: Record<SettingsSection, ComponentType> = {
  carrera: CareerSection,
  apariencia: AppearanceSection,
  asistente: AssistantSettingsSection,
  espacio: WorkspaceSection,
  privacidad: PrivacySection,
  datos: ExportSection,
  cuenta: AccountSection,
}

/**
 * Ajustes: a sub-navigation and one section at a time, addressed by
 * `?seccion=`. On a wide screen the two sit side by side and no section in the
 * URL means the default one. On a phone the sub-navigation IS the page
 * ("Todos los ajustes") until a section is picked; the section then carries a
 * way back. Which of the two a phone shows is CSS on `data-view`, so the
 * markup is the same at every width.
 */
export function SettingsScreen() {
  const backend = useBackend()
  const requiresAccount = useRequiresAccount()
  const requested = parseSettingsSearch(useSearch({ strict: false })).seccion
  const nav = settingsNav({ hasAccount: requiresAccount || Boolean(backend.account) })
  const active = resolveSettingsSection(requested, nav)
  const Section = SECTIONS[active]

  return (
    <div
      className="blue-secondary blue-screen settings"
      data-view={requested ? 'section' : 'list'}
    >
      <header className="blue-screen-head">
        <h1 className="blue-screen-title">Ajustes</h1>
      </header>

      <div className="settings-layout">
        <SettingsNav groups={nav} active={active} />
        <div className="settings-main">
          {requested ? (
            <Link to="/settings" className="settings-back">
              <ChevronLeft aria-hidden="true" />
              Todos los ajustes
            </Link>
          ) : null}
          <Section />
        </div>
      </div>
    </div>
  )
}

function SettingsNav({
  groups,
  active,
}: {
  groups: readonly SettingsNavGroup[]
  active: SettingsSection
}) {
  const baseId = useId()
  return (
    <nav aria-label="Secciones de ajustes" className="settings-nav">
      {groups.map((group, index) => {
        const headingId = `${baseId}-${index}`
        return (
          <div key={group.label} className="settings-nav-group">
            <p id={headingId} className="settings-nav-heading">
              {group.label}
            </p>
            <ul aria-labelledby={headingId}>
              {group.items.map(({ id, label, icon: Icon }) => {
                const current = id === active
                return (
                  <li key={id}>
                    <Link
                      to="/settings"
                      search={{ seccion: id }}
                      aria-current={current ? 'page' : undefined}
                      className={cn('settings-nav-item', current && 'is-active')}
                    >
                      <Icon aria-hidden="true" className="settings-nav-icon" />
                      <span className="min-w-0 flex-1">{label}</span>
                      <ChevronRight aria-hidden="true" className="settings-nav-chevron" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
