import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cloud,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { CampusLogo } from '@/components/brand/campus-logo'
import { Button } from '@/components/ui/button'
import { Illustration } from '@/components/ui/illustration'
import { TextField } from '@/components/ui/field'
import { useAuth } from '@/features/auth/auth-context'
import { isCloudUnreachable } from '@/features/auth/auth-errors'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'
import { useWorkspace } from '@/lib/runtime/workspace'

export const Route = createFileRoute('/login')({
  component: LoginScreen,
})

type Mode = 'signin' | 'signup' | 'reset' | 'new-password'

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
        : await signUp(email.trim(), password, displayName.trim())

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

  return (
    <main className="blue-onboarding">
      <div className="blue-onboarding-container">
        <header className="blue-onboarding-top">
          <CampusLogo wordmark className="blue-onboarding-brand" />
          <button
            type="button"
            onClick={workspace.change}
            className="blue-onboarding-text-link"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Elegir otro espacio
          </button>
        </header>
        <div className="blue-login-grid">
          <div className="blue-login-panel">
            {/* Choosing Campus Cloud was a choice, not a sentence: the way back to the
            picker (a local folder, another account) has to be on this screen. */}
            <div>
              <p className="blue-onboarding-eyebrow">
                <Cloud size={16} aria-hidden="true" /> Acceso a Campus Cloud
              </p>
              <h1>
                {mode === 'signup'
                  ? 'Tu recorrido empieza acá.'
                  : mode === 'reset'
                    ? 'Recuperá tu cuenta.'
                    : mode === 'new-password'
                      ? 'Elegí una contraseña nueva.'
                      : 'Bienvenido de nuevo.'}
              </h1>
              <p className="blue-login-lead">
                {mode === 'reset'
                  ? 'Te enviaremos un enlace a tu correo para recuperar el acceso.'
                  : mode === 'new-password'
                    ? 'Guardá una contraseña nueva para tu cuenta de Campus.'
                    : mode === 'signup'
                      ? 'Creá tu cuenta para organizar materias, entregas y tu plan de estudios desde distintos dispositivos.'
                      : 'Ingresá con tu cuenta para continuar con tu cursada.'}
              </p>
            </div>

            <div className="blue-login-mode" role="group" aria-label="Acción de cuenta">
              <button
                type="button"
                aria-pressed={mode === 'signup'}
                onClick={() => {
                  setMode('signup')
                  setError(null)
                  setNotice(null)
                  setSubmitted(false)
                }}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                aria-pressed={mode === 'signin'}
                onClick={() => {
                  setMode('signin')
                  setError(null)
                  setNotice(null)
                  setSubmitted(false)
                }}
              >
                Iniciar sesión
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="blue-login-fields">
              {mode === 'signup' ? (
                <TextField
                  label="¿Cómo te llamás?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="given-name"
                  placeholder="Camila"
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
                />
              )}

              {mode === 'signin' ? (
                <button
                  type="button"
                  className="blue-onboarding-text-link"
                  onClick={() => {
                    setMode('reset')
                    setNotice(null)
                    setError(null)
                    setSubmitted(false)
                  }}
                >
                  Recuperar contraseña
                </button>
              ) : mode === 'reset' ? (
                <button
                  type="button"
                  className="blue-onboarding-text-link"
                  onClick={() => {
                    setMode('signin')
                    setNotice(null)
                    setError(null)
                    setSubmitted(false)
                  }}
                >
                  Volver a iniciar sesión
                </button>
              ) : null}

              {notice ? (
                <p role="status" className="blue-login-message">
                  {notice}
                </p>
              ) : null}

              {error ? (
                <p role="alert" className="blue-login-message" data-error="true">
                  {error}
                </p>
              ) : null}

              <Button type="submit" variant="primary" size="lg" disabled={pending}>
                {pending
                  ? 'Un momento…'
                  : mode === 'signup'
                    ? 'Crear cuenta'
                    : mode === 'reset'
                      ? 'Enviar enlace'
                      : mode === 'new-password'
                        ? 'Guardar contraseña'
                        : 'Entrar'}
                {!pending && <ArrowRight size={17} aria-hidden="true" />}
              </Button>
            </form>

            <p className="blue-login-legal">
              Campus no te pide las credenciales de tu autogestión universitaria, y nunca lo va
              a hacer.
            </p>
          </div>
          <aside className="blue-login-side" aria-label="Campus Cloud">
            {/* Same frame either way: the swap only says the connection, not the form, failed. */}
            <Illustration
              name={isCloudUnreachable(error) ? 'offline-study' : 'workspace-cloud'}
              eager
              size="lg"
            />
            <span className="blue-onboarding-eyebrow">Todo tu espacio académico</span>
            <h2>Tu cursada, siempre a mano.</h2>
            <p>
              Con tu cuenta podés acceder a tu espacio de Campus desde la computadora o el
              celular.
            </p>
            <ul>
              <li>
                <GraduationCap size={18} aria-hidden="true" /> Tu carrera y tu plan de estudios
              </li>
              <li>
                <CheckCircle2 size={18} aria-hidden="true" /> Materias y progreso académico
              </li>
              <li>
                <ShieldCheck size={18} aria-hidden="true" /> Acceso con email y contraseña
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </main>
  )
}
