import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarCheck,
  Cloud,
  GraduationCap,
  Lock,
  Mail,
  NotebookPen,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { BrandWatermark } from '@/components/brand/brand-watermark'
import { CampusLogo } from '@/components/brand/campus-logo'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { Illustration } from '@/components/ui/illustration'
import type { IllustrationName } from '@/components/ui/illustrations'
import {
  ACCOUNT_DELETED_MESSAGE,
  takeAccountDeleted,
} from '@/features/account/account-deleted-notice'
import { MetricsConsentCheckbox } from '@/features/account/metrics-consent-checkbox'
import { useAuth } from '@/features/auth/auth-context'
import { isCloudUnreachable } from '@/features/auth/auth-errors'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'
import { useWorkspace } from '@/lib/runtime/workspace'

export const Route = createFileRoute('/login')({
  component: LoginScreen,
})

type Mode = 'signin' | 'signup' | 'reset' | 'new-password'

/** The picture per form. A sent email (`notice`) and an offline error override it. */
const MODE_ART: Record<Mode, IllustrationName> = {
  signin: 'login-signin',
  signup: 'login-signup',
  reset: 'password-recovery',
  'new-password': 'password-new',
}

const LOGIN_FEATURES = [
  { Icon: GraduationCap, text: 'Plan de estudios y correlativas claras.' },
  { Icon: CalendarCheck, text: 'Entregas y parciales en un solo lugar.' },
  { Icon: NotebookPen, text: 'Notas por materia, tuyas.' },
] as const

function LoginScreen() {
  const { signIn, signUp, session, loading, recovering, requestPasswordReset, updatePassword } =
    useAuth()
  const workspace = useWorkspace()
  useDocumentTitle('Entrar · Campus')
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  // Unticked by default: consent is something the student gives, not something
  // they have to find and take back.
  const [metricsConsent, setMetricsConsent] = useState(false)
  const [farewell, setFarewell] = useState<string | null>(null)

  // Arriving here right after "Borrar mi cuenta": say it worked, once.
  useEffect(() => {
    if (takeAccountDeleted()) setFarewell(ACCOUNT_DELETED_MESSAGE)
  }, [])

  useEffect(() => {
    if (recovering) setMode('new-password')
    else if (!loading && session && mode !== 'new-password') void navigate({ to: '/today' })
  }, [loading, session, navigate, recovering, mode])

  const emailError =
    email.trim() === ''
      ? 'Escribí tu email.'
      : !/^\S+@\S+\.\S+$/.test(email.trim())
        ? 'Revisá el email, no parece válido.'
        : null
  const passwordError =
    password.length < 6 ? 'La contraseña tiene que tener al menos 6 caracteres.' : null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitted(true)
    // Our own checks, in our own words. The form opts out of the browser's
    // (`noValidate`), whose text follows the browser language.
    if ((mode !== 'new-password' && emailError) || (mode !== 'reset' && passwordError)) return
    setPending(true)

    if (mode === 'reset') {
      const result = await requestPasswordReset(email.trim())
      setPending(false)
      if (result.error) setError(result.error)
      else
        setNotice(
          'Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña.',
        )
      return
    }
    if (mode === 'new-password') {
      const result = await updatePassword(password)
      setPending(false)
      if (result.error) setError(result.error)
      else {
        setPassword('')
        setMode('signin')
        setNotice('Contraseña actualizada. Ya podés continuar.')
        void navigate({ to: '/today' })
      }
      return
    }

    const result =
      mode === 'signin'
        ? { ...(await signIn(email.trim(), password)), needsConfirmation: false }
        : await signUp(email.trim(), password, displayName.trim(), { metricsConsent })

    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.needsConfirmation) {
      // No session yet: navigating to /today would just bounce back here with no
      // explanation. Say what to do next and leave the form on "Entrar".
      setMode('signin')
      setPassword('')
      setNotice(
        `Te mandamos un email a ${email.trim()}. Confirmalo y después entrá con tu contraseña.`,
      )
      return
    }
    // Always /today. The protected layout decides whether this student still
    // needs onboarding — one rule, no race with the session effect above.
    void navigate({ to: '/today' })
  }

  const resetFeedback = () => {
    setError(null)
    setNotice(null)
    setSubmitted(false)
  }
  const modeBtn =
    'h-10 flex-1 rounded-pill px-4 text-sm font-medium transition-colors text-ink-muted hover:text-ink ' +
    'aria-pressed:bg-paper-elevated aria-pressed:text-ink aria-pressed:shadow-raised'
  const messageClass =
    'rounded-xl border border-rule bg-paper-sunken px-3.5 py-3 text-sm text-ink'

  return (
    <main className="blue-onboarding bg-paper text-ink min-h-dvh overflow-x-hidden">
      <div className="mx-auto grid min-h-dvh max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-6 lg:p-6">
        <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-8 lg:py-4">
          <header className="flex items-center justify-between gap-3">
            <CampusLogo wordmark />
            <Button type="button" variant="ghost" size="sm" onClick={workspace.change}>
              <ArrowLeft aria-hidden="true" /> Elegir otro espacio
            </Button>
          </header>

          {/* Mobile: the brand reduced to a band. The full panel lives on lg+. */}
          <div className="relative isolate mt-5 overflow-hidden rounded-2xl bg-(--navy-surface) px-5 py-4 lg:hidden">
            <BrandWatermark className="top-1/2 -right-10 h-[190%] -translate-y-1/2" />
            <p className="relative z-10 text-base font-semibold tracking-tight text-(--navy-ink)">
              Tu cursada, <span className="text-(--navy-highlight)">ordenada.</span>
            </p>
            <p className="relative z-10 mt-0.5 text-sm text-(--navy-ink-muted)">
              Materias, entregas y notas en un solo lugar.
            </p>
          </div>

          {/* Choosing Campus Cloud was a choice, not a sentence: the way back to the
          picker (a local folder, another account) has to be on this screen. */}
          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-6 py-8">
            <div className="flex flex-col gap-3">
              {/* The picture follows the form, and says when the connection, not
                  the form, failed; the words stay in the form. */}
              <Illustration
                name={
                  isCloudUnreachable(error)
                    ? 'offline-study'
                    : notice
                      ? 'auth-email'
                      : MODE_ART[mode]
                }
                eager
                size="sm"
                className="-ml-4 sm:max-w-48"
              />
              <p className="text-accent-ink inline-flex items-center gap-2 text-sm font-medium">
                <Cloud size={16} aria-hidden="true" /> Acceso a Campus Cloud
              </p>
              <h1 className="text-ink text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-[2.5rem] sm:leading-[1.05]">
                {mode === 'signup'
                  ? 'Tu recorrido empieza acá.'
                  : mode === 'reset'
                    ? 'Recuperá tu cuenta.'
                    : mode === 'new-password'
                      ? 'Elegí una contraseña nueva.'
                      : 'Bienvenido de nuevo.'}
              </h1>
              <p className="text-ink-muted text-base">
                {mode === 'reset'
                  ? 'Te enviaremos un enlace a tu correo para recuperar el acceso.'
                  : mode === 'new-password'
                    ? 'Guardá una contraseña nueva para tu cuenta de Campus.'
                    : mode === 'signup'
                      ? 'Creá tu cuenta para organizar materias, entregas y tu plan de estudios desde distintos dispositivos.'
                      : 'Ingresá con tu cuenta para continuar con tu cursada.'}
              </p>
            </div>

            <div
              className="bg-paper-sunken rounded-pill flex gap-1 p-1"
              role="group"
              aria-label="Acción de cuenta"
            >
              <button
                type="button"
                className={modeBtn}
                aria-pressed={mode === 'signup'}
                onClick={() => {
                  setMode('signup')
                  resetFeedback()
                }}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                className={modeBtn}
                aria-pressed={mode === 'signin'}
                onClick={() => {
                  setMode('signin')
                  resetFeedback()
                }}
              >
                Iniciar sesión
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              {mode === 'signup' ? (
                <TextField
                  label="¿Cómo te llamás?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="given-name"
                  placeholder="Camila"
                  leadingIcon={<User aria-hidden="true" />}
                />
              ) : null}

              {mode !== 'new-password' && (
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  error={submitted ? emailError : null}
                  required
                  leadingIcon={<Mail aria-hidden="true" />}
                />
              )}

              {mode !== 'reset' && (
                <TextField
                  label="Contraseña"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  hint={mode === 'signup' ? 'Mínimo 6 caracteres.' : undefined}
                  error={submitted ? passwordError : null}
                  required
                  leadingIcon={<Lock aria-hidden="true" />}
                />
              )}

              {mode === 'signin' ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    setMode('reset')
                    resetFeedback()
                  }}
                >
                  Recuperar contraseña
                </Button>
              ) : mode === 'reset' ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    setMode('signin')
                    resetFeedback()
                  }}
                >
                  Volver a iniciar sesión
                </Button>
              ) : null}

              {mode === 'signup' ? (
                <MetricsConsentCheckbox checked={metricsConsent} onChange={setMetricsConsent} />
              ) : null}

              {farewell ? (
                <p role="status" className={messageClass}>
                  {farewell}
                </p>
              ) : null}

              {notice ? (
                <p role="status" className={messageClass}>
                  {notice}
                </p>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="border-danger/40 bg-danger-soft text-danger rounded-xl border px-3.5 py-3 text-sm"
                  data-error="true"
                >
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={pending}
                trailingArrow={!pending}
                className="w-full"
              >
                {pending
                  ? 'Un momento…'
                  : mode === 'signup'
                    ? 'Crear cuenta'
                    : mode === 'reset'
                      ? 'Enviar enlace'
                      : mode === 'new-password'
                        ? 'Guardar contraseña'
                        : 'Entrar'}
              </Button>
            </form>

            <p className="text-ink-muted text-xs">
              Campus no te pide las credenciales de tu autogestión universitaria, y nunca lo va
              a hacer.
            </p>
          </div>
        </div>

        {/* The deck's navy cover: the giant C bleeding off the edge, a two-tone
            headline, the features as chip tiles. */}
        <aside
          aria-label="Campus Cloud"
          className="relative isolate hidden overflow-hidden rounded-[28px] bg-(--navy-surface) p-14 text-(--navy-ink) lg:flex lg:flex-col lg:justify-center"
        >
          <BrandWatermark className="top-1/2 -right-[22%] h-[78%] -translate-y-1/2" />
          <div className="relative z-10 flex max-w-md flex-col gap-10">
            <h2 className="text-[3.5rem] leading-[1.02] font-semibold tracking-[-0.025em]">
              <span className="block">Tu cursada,</span>
              <span className="block text-(--navy-highlight)">ordenada.</span>
            </h2>
            <ul className="flex flex-col gap-5">
              {LOGIN_FEATURES.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-4 text-base font-medium">
                  <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-(--navy-chip)">
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  )
}
