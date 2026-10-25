import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { useAuth } from '@/features/auth/auth-context'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'
import { useWorkspace } from '@/lib/runtime/workspace'

export const Route = createFileRoute('/login')({
  component: LoginScreen,
})

type Mode = 'signin' | 'signup' | 'forgot' | 'recovery'

function LoginScreen() {
  const { signIn, signUp, sendPasswordReset, updatePassword, session, loading } = useAuth()
  const workspace = useWorkspace()
  useDocumentTitle('Entrar · Campus')
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>(() =>
    new URLSearchParams(window.location.search).has('recovery') ? 'recovery' : 'signup',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    // A recovery link signs the student in temporarily. Stay on this screen
    // until they set a new password instead of redirecting to the dashboard.
    if (!loading && session && mode !== 'recovery') void navigate({ to: '/today' })
  }, [loading, session, navigate, mode])

  const emailError =
    email.trim() === ''
      ? 'Escribí tu email.'
      : !/^\S+@\S+\.\S+$/.test(email.trim())
        ? 'Revisá el email, no parece válido.'
        : null
  const passwordError =
    password.length < 6 ? 'La contraseña tiene que tener al menos 6 caracteres.' : null
  const confirmPasswordError =
    confirmPassword !== password ? 'Las contraseñas no coinciden.' : null

  const changeMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
    setSubmitted(false)
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitted(true)
    // Our own checks, in our own words. The form opts out of the browser's
    // (`noValidate`), whose text follows the browser language.
    if (
      (mode !== 'recovery' && emailError) ||
      (mode !== 'forgot' && (passwordError || (mode === 'recovery' && confirmPasswordError)))
    )
      return
    if (mode === 'recovery' && !session) {
      setError('El enlace venció o todavía no se pudo validar. Pedí uno nuevo desde Entrar.')
      return
    }
    setPending(true)

    if (mode === 'forgot') {
      const result = await sendPasswordReset(email.trim())
      setPending(false)
      if (result.error) setError(result.error)
      else
        setNotice(
          'Si existe una cuenta con ese email, te enviamos un enlace para recuperar tu contraseña.',
        )
      return
    }
    if (mode === 'recovery') {
      const result = await updatePassword(password)
      setPending(false)
      if (result.error) setError(result.error)
      else void navigate({ to: '/today' })
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
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-sm">
        {/* Choosing Campus Cloud was a choice, not a sentence: the way back to the
            picker (a local folder, another account) has to be on this screen. */}
        <button
          type="button"
          onClick={workspace.change}
          className="text-ink-muted hover:text-ink mb-6 -ml-1 inline-flex min-h-8 items-center gap-1 text-sm underline-offset-4 hover:underline"
        >
          Volver a elegir dónde trabajar
        </button>

        <div className="mb-8">
          <p className="text-ink flex items-center gap-2 font-serif text-xl">
            <span aria-hidden="true" className="bg-accent inline-block h-5 w-1 rounded-full" />
            Campus
          </p>
          <h1 className="text-ink mt-6 font-serif text-2xl leading-tight">
            {mode === 'signup'
              ? 'Tu cursada, ordenada.'
              : mode === 'signin'
                ? 'Bienvenido de vuelta.'
                : mode === 'forgot'
                  ? 'Recuperá tu acceso.'
                  : 'Elegí una nueva contraseña.'}
          </h1>
          <p className="text-ink-muted mt-2 text-sm">
            {mode === 'signup'
              ? 'Plan de estudios, materias, entregas y correlativas en un solo lugar.'
              : mode === 'signin'
                ? 'Entrá para ver qué tenés hoy.'
                : mode === 'forgot'
                  ? 'Te mandamos un enlace al email de tu cuenta.'
                  : 'Guardala para volver a entrar a Campus.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {mode === 'signup' ? (
            <TextField
              label="¿Cómo te llamás?"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="given-name"
              placeholder="Camila"
            />
          ) : null}

          {mode !== 'recovery' ? (
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              error={submitted ? emailError : null}
              required
            />
          ) : null}

          {mode !== 'forgot' ? (
            <TextField
              label={mode === 'recovery' ? 'Nueva contraseña' : 'Contraseña'}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === 'signup' || mode === 'recovery' ? 'new-password' : 'current-password'
              }
              hint={
                mode === 'signup' || mode === 'recovery' ? 'Mínimo 6 caracteres.' : undefined
              }
              error={submitted ? passwordError : null}
              required
            />
          ) : null}

          {mode === 'recovery' ? (
            <TextField
              label="Repetí la nueva contraseña"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              error={submitted ? confirmPasswordError : null}
              required
            />
          ) : null}

          {mode === 'signin' ? (
            <button
              type="button"
              onClick={() => changeMode('forgot')}
              className="text-accent-ink self-start text-sm font-medium underline-offset-4 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          ) : null}

          {notice ? (
            <p role="status" className="text-ink text-sm font-medium">
              {notice}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="text-danger text-sm font-medium">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-1">
            {pending
              ? 'Un momento…'
              : mode === 'signup'
                ? 'Crear cuenta'
                : mode === 'signin'
                  ? 'Entrar'
                  : mode === 'forgot'
                    ? 'Enviar enlace'
                    : 'Guardar contraseña'}
          </Button>
        </form>

        <p className="text-ink-muted mt-6 text-sm">
          {mode === 'signup'
            ? '¿Ya tenés cuenta?'
            : mode === 'signin'
              ? '¿Todavía no tenés cuenta?'
              : '¿Querés volver a entrar?'}{' '}
          <button
            type="button"
            onClick={() =>
              changeMode(
                mode === 'signup' || mode === 'forgot' || mode === 'recovery'
                  ? 'signin'
                  : 'signup',
              )
            }
            className="text-accent-ink font-medium underline-offset-4 hover:underline"
          >
            {mode === 'signup' ? 'Entrá' : mode === 'signin' ? 'Creá una' : 'Entrar'}
          </button>
        </p>

        <p className="text-ink-muted mt-10 text-xs">
          Campus no te pide las credenciales de tu autogestión universitaria, y nunca lo va a
          hacer.
        </p>
      </div>
    </main>
  )
}
