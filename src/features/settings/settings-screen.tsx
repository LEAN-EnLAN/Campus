import { Link } from '@tanstack/react-router'
import { ArrowLeftRight, Check, ExternalLink, LogOut, Sun } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Illustration } from '@/components/ui/illustration'
import type { IllustrationName } from '@/components/ui/illustrations'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAuth } from '@/features/auth/auth-context'
import { useSignOut } from '@/features/auth/use-sign-out'
import { ExportSection } from '@/features/settings/export-section'
import { useRequiresAccount } from '@/lib/runtime/identity'
import { useWorkspace } from '@/lib/runtime/workspace'
import { useTheme } from '@/lib/theme/theme-context'

import { PrivacySection } from './privacy-section'

/** Blue is the only available accent in Proposal 2. ThemeProvider owns persistence. */
export const CAMPUS_BLUE_HUE = 225

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

  // The accepted proposal has one visual identity: light surfaces and blue
  // accent. Migrate older saved dark/system/multicolor choices through the real
  // provider, so modals and screens outside this route use the same preference.
  useEffect(() => {
    if (preference !== 'light') setPreference('light')
    if (accentHue !== CAMPUS_BLUE_HUE) setAccentHue(CAMPUS_BLUE_HUE)
  }, [preference, accentHue, setPreference, setAccentHue])

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
            description="El diseño azul de Campus, en modo claro."
            illustration="settings-appearance"
          >
            <div className="blue-settings-choice-grid">
              <div className="blue-settings-choice-group">
                <h3>Modo de visualización</h3>
                <div role="group" aria-label="Tema de la aplicación">
                  <button
                    type="button"
                    aria-pressed={preference === 'light'}
                    className="blue-settings-choice"
                    onClick={() => setPreference('light')}
                  >
                    <span
                      className="blue-settings-preview blue-settings-preview-light"
                      aria-hidden="true"
                    >
                      <span className="blue-settings-preview-nav" />
                      <span className="blue-settings-preview-content">
                        <i />
                        <i />
                        <i />
                      </span>
                      <Sun className="blue-settings-preview-symbol" size={17} />
                    </span>
                    <span className="blue-settings-choice-label">
                      <Sun size={16} aria-hidden="true" />
                      <span>Claro</span>
                      {preference === 'light' ? (
                        <Check
                          size={16}
                          className="blue-settings-choice-check"
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                  </button>
                </div>
              </div>
              <div className="blue-settings-choice-group">
                <h3>Color de la interfaz</h3>
                <div role="group" aria-label="Color de acento">
                  <button
                    type="button"
                    aria-pressed={accentHue === CAMPUS_BLUE_HUE}
                    className="blue-settings-choice"
                    onClick={() => setAccentHue(CAMPUS_BLUE_HUE)}
                  >
                    <span
                      className="blue-settings-preview blue-settings-preview-blue"
                      aria-hidden="true"
                    >
                      <span className="blue-settings-preview-blue-window">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="blue-settings-preview-blue-dot" />
                    </span>
                    <span className="blue-settings-choice-label">
                      <span className="blue-settings-blue-swatch" aria-hidden="true" />
                      <span>Azul Campus</span>
                      {accentHue === CAMPUS_BLUE_HUE ? (
                        <Check
                          size={16}
                          className="blue-settings-choice-check"
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                  </button>
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
              description="Información de acceso a Campus Cloud."
              actions={
                <Button
                  variant="secondary"
                  disabled={signOut.pending}
                  onClick={() => void signOut.signOut()}
                >
                  <LogOut aria-hidden="true" />
                  {signOut.pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
                </Button>
              }
            >
              <dl className="blue-settings-rows">
                <DetailRow label="Email">
                  {session?.user.email || 'Email no disponible'}
                </DetailRow>
              </dl>
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
                <Link to="/onboarding" className={buttonVariants({ variant: 'secondary' })}>
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
          <ExportSection />
        </div>
      </div>
    </div>
  )
}
