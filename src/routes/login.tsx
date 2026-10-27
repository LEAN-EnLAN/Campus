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

import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { useAuth } from '@/features/auth/auth-context'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'
import { useWorkspace } from '@/lib/runtime/workspace'

import '@/styles/blue-onboarding.css'

export const Route = createFileRoute('/login')({
  component: LoginScreen,
})

type Mode = 'signin' | 'signup'

function LoginScreen() {
  const { signIn, signUp, session, loading } = useAuth()
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
    if (!loading && session) void navigate({ to: '/today' })
  }, [loading, session, navigate])

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
    if (emailError || passwordError) return
    setPending(true)

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
          <div className="blue-onboarding-brand">
            <span className="blue-onboarding-brand-mark" aria-hidden="true">
              C
            </span>
            <span>
              Campus<span className="blue-onboarding-brand-dot">.</span>
            </span>
          </div>
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
                {mode === 'signup' ? 'Tu recorrido empieza acá.' : 'Bienvenido de nuevo.'}
              </h1>
              <p className="blue-login-lead">
                {mode === 'signup'
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

              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                error={submitted ? emailError : null}
                required
              />

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
                {pending ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
                {!pending && <ArrowRight size={17} aria-hidden="true" />}
              </Button>
            </form>

            <p className="blue-login-legal">
              Campus no te pide las credenciales de tu autogestión universitaria, y nunca lo va
              a hacer.
            </p>
          </div>
          <aside className="blue-login-side" aria-label="Campus Cloud">
            <img
              src="/campus-blue-assets/workspace-cloud.svg"
              width={640}
              height={400}
              alt="Ilustración de un espacio académico almacenado en Cloud"
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
