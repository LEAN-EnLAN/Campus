import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CircleUserRound,
  Cloud,
  FolderOpen,
  GraduationCap,
  LockKeyhole,
  LogOut,
  MonitorCog,
  Palette,
  ShieldCheck,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAuth } from '@/features/auth/auth-context'
import { useRequiresAccount } from '@/lib/runtime/identity'
import { useWorkspace } from '@/lib/runtime/workspace'
import { useTheme } from '@/lib/theme/theme-context'

/** Blue is the only available accent in Proposal 2. ThemeProvider owns persistence. */
export const CAMPUS_BLUE_HUE = 225

function SettingsCard({
  id,
  icon: Icon,
  title,
  description,
  children,
  className = '',
}: {
  id: string
  icon: LucideIcon
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={'blue-settings-card ' + className} aria-labelledby={id}>
      <header className="blue-settings-card-head">
        <span className="blue-settings-section-icon" aria-hidden="true">
          <Icon size={20} strokeWidth={1.85} />
        </span>
        <div>
          <h2 id={id}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      {children}
    </section>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="blue-settings-detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function SettingsScreen() {
  const { preference, setPreference, accentHue, setAccentHue } = useTheme()
  const { session, signOut } = useAuth()
  const requiresAccount = useRequiresAccount()
  const workspace = useWorkspace()
  const plan = useAcademicPlan()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  // The accepted proposal has one visual identity: light surfaces and blue
  // accent. Migrate older saved dark/system/multicolor choices through the real
  // provider, so modals and screens outside this route use the same preference.
  useEffect(() => {
    if (preference !== 'light') setPreference('light')
    if (accentHue !== CAMPUS_BLUE_HUE) setAccentHue(CAMPUS_BLUE_HUE)
  }, [preference, accentHue, setPreference, setAccentHue])

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError(null)
    try {
      await signOut()
      void navigate({ to: '/login' })
    } catch {
      setSignOutError('No pudimos cerrar la sesión. Intentá de nuevo.')
    } finally {
      setSigningOut(false)
    }
  }

  const currentSpace = workspace.folder ? 'En esta computadora' : 'Campus Cloud'
  const academicName =
    plan.curriculum?.version ?? plan.curriculum?.name ?? plan.context?.unmappedLabel ?? '—'

  return (
    <div className="blue-secondary blue-settings blue-screen">
      <header className="blue-settings-heading">
        <p className="blue-settings-eyebrow">
          <MonitorCog size={15} aria-hidden="true" /> PREFERENCIAS Y CUENTA
        </p>
        <h1>Ajustes</h1>
        <p>Configurá tu experiencia y administrá el espacio donde estudiás.</p>
      </header>

      <div className="blue-settings-grid">
        <div className="blue-settings-column">
          <SettingsCard
            id="settings-appearance"
            icon={Palette}
            title="Apariencia"
            description="El diseño azul de Campus, en modo claro."
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
                      <Sun size={17} aria-hidden="true" />
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
            <p className="blue-settings-device-note">
              <Check size={15} aria-hidden="true" />
              Tus preferencias de apariencia se guardan en este dispositivo.
            </p>
          </SettingsCard>

          <SettingsCard
            id="settings-workspace"
            icon={workspace.folder ? FolderOpen : Cloud}
            title="Espacio de trabajo"
            description="Dónde están disponibles tus datos en esta sesión."
          >
            <div className="blue-settings-workspace">
              <span className="blue-settings-workspace-icon" aria-hidden="true">
                {workspace.folder ? <FolderOpen size={25} /> : <Cloud size={25} />}
              </span>
              <div className="blue-settings-workspace-info">
                <span className="blue-settings-current-label">
                  <span className="blue-settings-status-dot" /> ESPACIO ACTUAL
                </span>
                <strong>{currentSpace}</strong>
                <span>
                  {workspace.folder ? workspace.folder.name : 'Cuenta de Campus Cloud'}
                </span>
              </div>
            </div>
            {workspace.folder ? (
              <dl className="blue-settings-details">
                <DetailRow label="Nombre">{workspace.folder.name}</DetailRow>
                <DetailRow label="Ubicación">
                  <span className="blue-settings-filepath">{workspace.folder.path}</span>
                </DetailRow>
              </dl>
            ) : (
              <p className="blue-settings-inline-note">
                Usás tu cuenta Cloud. Los archivos de una carpeta Local no se sincronizan
                automáticamente.
              </p>
            )}
            <Button
              variant="secondary"
              onClick={workspace.change}
              className="blue-settings-action"
            >
              Cambiar de espacio de trabajo <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </SettingsCard>
        </div>

        <div className="blue-settings-column">
          {requiresAccount ? (
            <SettingsCard
              id="settings-account"
              icon={CircleUserRound}
              title="Tu cuenta"
              description="Información de acceso a Campus Cloud."
            >
              <dl className="blue-settings-details">
                <DetailRow label="Email">
                  {session?.user.email || 'Email no disponible'}
                </DetailRow>
              </dl>
              <Button
                variant="secondary"
                className="blue-settings-action blue-settings-signout"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
              >
                <LogOut size={16} aria-hidden="true" />
                {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </Button>
              {signOutError ? (
                <p role="alert" className="blue-settings-error">
                  {signOutError}
                </p>
              ) : null}
            </SettingsCard>
          ) : null}

          <SettingsCard
            id="settings-academic"
            icon={GraduationCap}
            title="Tu carrera"
            description="Información del plan académico activo."
          >
            {plan.hasContext ? (
              <>
                <div className="blue-settings-academic">
                  <span className="blue-settings-academic-icon" aria-hidden="true">
                    <BookOpenCheck size={21} />
                  </span>
                  <div>
                    <span>PLAN DE ESTUDIOS</span>
                    <strong>{academicName}</strong>
                    {plan.programName ? <p>{plan.programName}</p> : null}
                  </div>
                </div>
                {plan.curriculum?.version && plan.curriculum.name ? (
                  <details className="blue-settings-plan-detail">
                    <summary>Ver detalle</summary>
                    <p>{plan.curriculum.name}</p>
                  </details>
                ) : null}
                {plan.curriculum?.sourceUrl ? (
                  <a
                    className="blue-settings-official-link"
                    href={plan.curriculum.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Documento oficial <ArrowRight size={15} aria-hidden="true" />
                  </a>
                ) : null}
              </>
            ) : (
              <p className="blue-settings-empty">Todavía no elegiste tu carrera.</p>
            )}
            <Link to="/onboarding" className="blue-settings-link">
              Cambiar mi carrera <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </SettingsCard>

          <SettingsCard
            id="settings-privacy"
            icon={ShieldCheck}
            title="Privacidad"
            description="Qué información utiliza Campus."
          >
            <div className="blue-settings-privacy">
              <LockKeyhole size={19} aria-hidden="true" />
              <div>
                <p>
                  Campus nunca te pide las credenciales de tu autogestión universitaria ni se
                  conecta con los sistemas de tu facultad.
                </p>
                {workspace.folder ? (
                  <p>
                    Tus materias, entregas y notas quedan en archivos de tu carpeta, en esta
                    computadora. Campus no los envía a ningún servidor.
                  </p>
                ) : (
                  <p>
                    Tu información de Campus Cloud se protege mediante controles de acceso de la
                    base de datos y políticas por usuario.
                  </p>
                )}
                <p>
                  Los planes de estudio provienen de documentos oficiales. Si falta información
                  verificada, Campus lo indica.
                </p>
              </div>
            </div>
          </SettingsCard>
        </div>
      </div>
    </div>
  )
}
