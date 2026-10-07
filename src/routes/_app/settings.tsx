import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'

import { PageHeader, SectionHeading } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAuth } from '@/features/auth/auth-context'
import { harmonic, SEED_HUES, toCss } from '@/lib/design/palette'
import { useRequiresAccount } from '@/lib/runtime/identity'
import { useWorkspace } from '@/lib/runtime/workspace'
import { useTheme } from '@/lib/theme/theme-context'
import type { ThemePreference } from '@/lib/theme/theme'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsScreen,
})

const THEMES = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
  { value: 'system', label: 'Como el sistema', Icon: Monitor },
] as const satisfies readonly { value: ThemePreference; label: string; Icon: LucideIcon }[]

/**
 * The accent swatches.
 *
 * Hues, not colours — every one is rendered through `harmonic`, so the palette
 * decides how intense it is and the student decides only which way round the
 * wheel it sits. That is the whole reason a picker here cannot break the design
 * system: there is no way to express a colour outside the envelope.
 *
 * Spaced by the same golden angle the subject colours use, starting at the four
 * seeds so the set opens on colours the palette already contains.
 */
const ACCENT_PRESETS: readonly { hue: number; name: string }[] = [
  { hue: SEED_HUES.tomatoJam, name: 'Rojo' },
  { hue: SEED_HUES.vanillaCustard, name: 'Amarillo' },
  { hue: 160, name: 'Verde' },
  { hue: SEED_HUES.linen, name: 'Arena' },
  { hue: 265, name: 'Violeta' },
  { hue: 310, name: 'Rosa' },
]

const DEFAULT_ACCENT_NAME = 'Turquesa'

function SettingsScreen() {
  const { preference, setPreference, theme, accentHue, setAccentHue } = useTheme()
  const { session, signOut } = useAuth()
  // Capability questions, answered by the composition root: whether this
  // workspace has an account, and which folder it is. Never "which mode".
  const requiresAccount = useRequiresAccount()
  const workspace = useWorkspace()
  const plan = useAcademicPlan()
  const navigate = useNavigate()

  const accentName =
    accentHue === null
      ? DEFAULT_ACCENT_NAME
      : (ACCENT_PRESETS.find((preset) => preset.hue === accentHue)?.name ?? DEFAULT_ACCENT_NAME)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Ajustes" />

      <section aria-labelledby="apariencia" className="flex flex-col gap-3">
        <SectionHeading id="apariencia">Apariencia</SectionHeading>
        <p className="text-ink-muted text-sm">
          «Como el sistema» sigue lo que tenga configurado tu máquina, y cambia solo si la
          cambiás.
        </p>
        <div
          role="group"
          aria-label="Tema de la aplicación"
          className="border-rule flex w-fit gap-0.5 rounded-md border p-0.5"
        >
          {THEMES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={preference === value}
              onClick={() => setPreference(value)}
              className={cn(
                'flex min-h-8 items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition-colors duration-150',
                preference === value
                  ? 'bg-accent-soft text-accent-ink font-medium'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </button>
          ))}
        </div>

        <p className="text-ink-muted mt-2 text-sm">
          Color de acento: <span className="text-ink font-medium">{accentName}</span>. Todos los
          tonos combinan con el resto de la app.
        </p>
        <div role="group" aria-label="Color de acento" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={accentHue === null}
            onClick={() => setAccentHue(null)}
            title={`${DEFAULT_ACCENT_NAME}, el de siempre`}
            className={cn(
              'border-rule size-7 rounded-md border transition-transform duration-150',
              accentHue === null &&
                'ring-ink ring-2 ring-offset-2 ring-offset-[var(--color-paper)]',
            )}
            style={{
              backgroundColor: toCss(harmonic(SEED_HUES.tropicalTeal, 'subject', theme)),
            }}
          >
            <span className="sr-only">{DEFAULT_ACCENT_NAME}</span>
          </button>

          {ACCENT_PRESETS.map(({ hue, name }) => (
            <button
              key={hue}
              type="button"
              aria-pressed={accentHue === hue}
              onClick={() => setAccentHue(hue)}
              title={name}
              className={cn(
                'border-rule size-7 rounded-md border transition-transform duration-150',
                accentHue === hue &&
                  'ring-ink ring-2 ring-offset-2 ring-offset-[var(--color-paper)]',
              )}
              style={{ backgroundColor: toCss(harmonic(hue, 'subject', theme)) }}
            >
              <span className="sr-only">{name}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="espacio" className="flex flex-col gap-3">
        <SectionHeading id="espacio">
          {workspace.folder ? 'Tu carpeta' : 'Dónde trabajás'}
        </SectionHeading>
        {workspace.folder ? (
          <>
            <p className="text-ink-muted text-sm">
              Campus guarda tus materias, entregas, notas y material en esta carpeta.
            </p>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="border-rule-soft flex justify-between gap-4 border-b py-2">
                <dt className="text-ink-muted">Nombre</dt>
                <dd className="text-ink text-right">{workspace.folder.name}</dd>
              </div>
              <div className="border-rule-soft flex justify-between gap-4 border-b py-2">
                <dt className="text-ink-muted">Ubicación</dt>
                <dd className="text-ink min-w-0 text-right break-all">
                  {workspace.folder.path}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-ink-muted text-sm">
            Estás trabajando en Campus Cloud, sincronizado con tu cuenta.
          </p>
        )}
        <Button variant="secondary" className="self-start" onClick={workspace.change}>
          Cambiar de espacio de trabajo
        </Button>
      </section>

      {requiresAccount ? (
        <section aria-labelledby="cuenta" className="flex flex-col gap-3">
          <SectionHeading id="cuenta">Tu cuenta</SectionHeading>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="border-rule-soft flex justify-between gap-4 border-b py-2">
              <dt className="text-ink-muted">Email</dt>
              <dd className="text-ink truncate">{session?.user.email}</dd>
            </div>
          </dl>
          <Button
            variant="secondary"
            className="self-start"
            onClick={async () => {
              await signOut()
              void navigate({ to: '/login' })
            }}
          >
            Cerrar sesión
          </Button>
        </section>
      ) : null}

      <section aria-labelledby="carrera" className="flex flex-col gap-3">
        <SectionHeading id="carrera">Tu carrera</SectionHeading>
        {plan.hasContext ? (
          <dl className="flex flex-col gap-2 text-sm">
            <div className="border-rule-soft flex justify-between gap-4 border-b py-2">
              <dt className="text-ink-muted">Plan</dt>
              <dd className="text-ink text-right">
                {plan.curriculum?.version ??
                  plan.curriculum?.name ??
                  plan.context?.unmappedLabel ??
                  '—'}
              </dd>
            </div>
            {plan.curriculum?.version && plan.curriculum.name ? (
              <details className="text-ink-muted text-xs">
                <summary className="min-h-8 cursor-pointer py-1.5 underline-offset-4 hover:underline">
                  Ver detalle
                </summary>
                <p className="pb-1">{plan.curriculum.name}</p>
              </details>
            ) : null}
            {plan.curriculum?.sourceUrl ? (
              <div className="border-rule-soft flex justify-between gap-4 border-b py-2">
                <dt className="text-ink-muted">Fuente</dt>
                <dd className="text-right">
                  <a
                    href={plan.curriculum.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent-ink underline underline-offset-4"
                  >
                    Documento oficial
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-ink-muted text-sm">Todavía no elegiste tu carrera.</p>
        )}
        <Link
          to="/onboarding"
          className="text-accent-ink self-start text-sm font-medium underline-offset-4 hover:underline"
        >
          Cambiar mi carrera
        </Link>
      </section>

      <section aria-labelledby="privacidad" className="flex flex-col gap-3">
        <SectionHeading id="privacidad">Privacidad</SectionHeading>
        <div className="text-ink-muted flex flex-col gap-2 text-sm">
          <p>
            Campus nunca te va a pedir las credenciales de tu autogestión universitaria, ni se
            conecta con los sistemas de tu facultad.
          </p>
          {workspace.folder ? (
            <p>
              Tus materias, entregas y notas quedan en archivos de tu carpeta, en esta
              computadora. Campus no los envía a ningún servidor.
            </p>
          ) : (
            <p>
              Tus materias, entregas y material son tuyos: nadie más que vos puede verlos, y eso
              está garantizado en la base de datos, no solo en la interfaz.
            </p>
          )}
          <p>
            Los planes de estudio salen de documentos oficiales publicados por cada universidad.
            Si algo no lo pudimos verificar, lo decimos en vez de inventarlo.
          </p>
        </div>
      </section>
    </div>
  )
}
