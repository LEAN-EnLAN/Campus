import { Link } from '@tanstack/react-router'
import { ArrowLeftRight, Check, ExternalLink, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Illustration } from '@/components/ui/illustration'
import type { IllustrationName } from '@/components/ui/illustrations'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useAcademicPlan } from '@/features/academic/queries'
import { AssistantSettingsSection } from '@/features/assistant/assistant-settings'
import { useAuth } from '@/features/auth/auth-context'
import { useSignOut } from '@/features/auth/use-sign-out'
import { ExportSection } from '@/features/settings/export-section'
import { LocalCopySection } from '@/features/settings/local-copy-section'
import { useRequiresAccount } from '@/lib/runtime/identity'
import { useWorkspace } from '@/lib/runtime/workspace'
import {
  ACCENTS,
  DEFAULT_ACCENT_HUE,
  type AccentId,
  type ThemePreference,
} from '@/lib/theme/theme'
import { useTheme } from '@/lib/theme/theme-context'
import { cn } from '@/lib/utils'

import { PrivacySection } from './privacy-section'

/** Azul Campus, the default accent. ThemeProvider owns persistence. */
export const CAMPUS_BLUE_HUE = DEFAULT_ACCENT_HUE

const MODES = [
  { value: 'light', label: 'Claro', icon: <Sun /> },
  { value: 'dark', label: 'Oscuro', icon: <Moon /> },
  { value: 'system', label: 'Sistema', icon: <Monitor /> },
] as const satisfies readonly { value: ThemePreference; label: string; icon: ReactNode }[]

/** Literal classes so Tailwind sees them; values live in tokens.css. */
const SWATCH: Record<AccentId, string> = {
  azul: 'bg-(--swatch-azul)',
  verde: 'bg-(--swatch-verde)',
  coral: 'bg-(--swatch-coral)',
  violeta: 'bg-(--swatch-violeta)',
}

/**
 * One settings group. Hierarchy is carried by size and position, not weight:
 * title (lg/600) → description (sm/400 muted) → rows → actions, the actions
 * always last and set off by a rule so they never run into the content.
 */
function SettingsCard({
  id,
  title,
  description,
  illustration,
  actions,
  children,
}: {
  id: string
  title: string
  description?: string
  /** A small decorative spot beside the title; the title already says what it shows. */
  illustration?: IllustrationName
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="blue-settings-card" aria-labelledby={id}>
      <header className="blue-settings-card-head">
        <div className="min-w-0">
          <h2 id={id}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {illustration ? (
          <Illustration
            name={illustration}
            decorative
            size="icon"
            className="-mt-1 w-16 shrink-0 sm:w-20"
          />
        ) : null}
      </header>
      {children}
      {actions ? <div className="blue-settings-actions">{actions}</div> : null}
    </section>
  )
}

/** Label/value pair on a shared column, so every card's rows line up. */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="blue-settings-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function SettingsScreen() {
  const { preference, setPreference, accentHue, setAccentHue } = useTheme()
  const { session } = useAuth()
  const signOut = useSignOut()
  const requiresAccount = useRequiresAccount()
  const workspace = useWorkspace()
  const plan = useAcademicPlan()
  const activeHue = accentHue ?? CAMPUS_BLUE_HUE
  const email = session?.user.email || ''

  const academicName =
    plan.curriculum?.version ?? plan.curriculum?.name ?? plan.context?.unmappedLabel ?? '—'

  return (
    <div className="blue-secondary blue-settings blue-screen">
      <header className="blue-screen-head">
        <div>
          <h1 className="blue-screen-title">Ajustes</h1>
          <p className="blue-screen-subtitle">
            Configurá tu experiencia y administrá el espacio donde estudiás.
          </p>
        </div>
      </header>

      <div className="blue-settings-grid">
        <div className="blue-settings-column">
          <SettingsCard
            id="settings-workspace"
            title="Espacio de trabajo"
            description="Dónde están disponibles tus datos en esta sesión."
            illustration="settings-workspace"
            actions={
              <Button variant="secondary" onClick={workspace.change}>
                <ArrowLeftRight aria-hidden="true" />
                Cambiar de espacio de trabajo
              </Button>
            }
          >
            <dl className="blue-settings-rows">
              <DetailRow label="Espacio actual">
                {workspace.folder ? 'En esta computadora' : 'Campus Cloud'}
              </DetailRow>
              {workspace.folder ? (
                <>
                  <DetailRow label="Carpeta">{workspace.folder.name}</DetailRow>
                  <DetailRow label="Ubicación">
                    <span className="blue-settings-filepath">{workspace.folder.path}</span>
                  </DetailRow>
                </>
              ) : null}
            </dl>
            {workspace.folder ? null : (
              <p className="blue-settings-note">
                Usás tu cuenta Cloud. Los archivos de una carpeta Local no se sincronizan
                automáticamente.
              </p>
            )}
          </SettingsCard>

          <SettingsCard
            id="settings-appearance"
            title="Apariencia"
            description="Elegí el modo y el color con el que querés ver Campus."
            illustration="settings-appearance"
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <h3 className="text-ink text-sm font-medium">Modo</h3>
                <SegmentedControl
                  label="Tema de la aplicación"
                  options={MODES}
                  value={preference}
                  onChange={setPreference}
                />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-ink text-sm font-medium">Color</h3>
                <div role="group" aria-label="Color de acento" className="flex flex-wrap gap-2">
                  {ACCENTS.map((accent) => {
                    const selected = accent.hue === activeHue
                    return (
                      <button
                        key={accent.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setAccentHue(accent.hue)}
                        className={cn(
                          'rounded-pill inline-flex min-h-10 items-center gap-2 border py-1.5 pr-3.5 pl-1.5 text-sm font-medium',
                          'ease-out-expo transition-[background-color,border-color,color] duration-150',
                          'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
                          selected
                            ? 'border-accent bg-accent-soft text-accent-ink'
                            : 'border-rule bg-paper-elevated text-ink-muted hover:border-field hover:text-ink',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid size-7 place-items-center rounded-full text-white',
                            SWATCH[accent.id],
                          )}
                        >
                          {selected ? <Check className="size-4" /> : null}
                        </span>
                        {accent.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <p className="blue-settings-note">
              Tus preferencias de apariencia se guardan en este dispositivo.
            </p>
          </SettingsCard>
        </div>

        <div className="blue-settings-column">
          {requiresAccount ? (
            <SettingsCard
              id="settings-account"
              title="Tu cuenta"
              description="Con esta cuenta entrás a Campus Cloud."
            >
              <div className="bg-paper-sunken border-rule-soft flex flex-wrap items-center gap-3 rounded-2xl border p-3 sm:flex-nowrap">
                <span
                  aria-hidden="true"
                  className="bg-accent text-on-tint grid size-11 shrink-0 place-items-center rounded-full text-base font-semibold uppercase"
                >
                  {email ? email.charAt(0) : '?'}
                </span>
                <dl className="min-w-0 flex-1">
                  <dt className="sr-only">Email</dt>
                  <dd className="text-ink truncate text-sm font-medium">
                    {email || 'Email no disponible'}
                  </dd>
                  <dt className="sr-only">Espacio</dt>
                  <dd className="text-ink-muted text-xs">Campus Cloud</dd>
                </dl>
                <Button
                  variant="danger-outline"
                  size="md"
                  className="w-full sm:w-auto"
                  disabled={signOut.pending}
                  onClick={() => void signOut.signOut()}
                >
                  <LogOut aria-hidden="true" />
                  {signOut.pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
                </Button>
              </div>
              {signOut.error ? (
                <p role="alert" className="blue-settings-error">
                  {signOut.error}
                </p>
              ) : null}
            </SettingsCard>
          ) : null}

          <SettingsCard
            id="settings-academic"
            title="Tu carrera"
            description="Información del plan académico activo."
            illustration="settings-career"
            actions={
              <>
                <Link
                  to="/onboarding"
                  search={{ from: 'settings' }}
                  className={buttonVariants({ variant: 'secondary' })}
                >
                  Cambiar mi carrera
                </Link>
                {plan.hasContext && plan.curriculum?.sourceUrl ? (
                  <a
                    className="blue-settings-link"
                    href={plan.curriculum.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Documento oficial
                    <ExternalLink aria-hidden="true" />
                    <span className="sr-only">(se abre en otra pestaña)</span>
                  </a>
                ) : null}
              </>
            }
          >
            {plan.hasContext ? (
              <>
                <dl className="blue-settings-rows">
                  {plan.programName ? (
                    <DetailRow label="Carrera">{plan.programName}</DetailRow>
                  ) : null}
                  <DetailRow label="Plan de estudios">{academicName}</DetailRow>
                </dl>
                {plan.curriculum?.version && plan.curriculum.name ? (
                  <details className="blue-settings-plan-detail">
                    <summary>Ver detalle</summary>
                    <p>{plan.curriculum.name}</p>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="blue-settings-note">Todavía no elegiste tu carrera.</p>
            )}
          </SettingsCard>

          <PrivacySection />
          <AssistantSettingsSection />
          <ExportSection />
          <LocalCopySection />
        </div>
      </div>
    </div>
  )
}
