import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { useAuth } from '@/features/auth/auth-context'

export const Route = createFileRoute('/login')({
  component: LoginScreen,
})

type Mode = 'signin' | 'signup'

function LoginScreen() {
  const { signIn, signUp, session, loading } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!loading && session) void navigate({ to: '/today' })
  }, [loading, session, navigate])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const result =
      mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, displayName.trim())

    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    // Always /today. The protected layout decides whether this student still
    // needs onboarding — one rule, no race with the session effect above.
    void navigate({ to: '/today' })
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <p className="text-ink flex items-center gap-2 font-serif text-xl">
            <span aria-hidden="true" className="bg-accent inline-block h-5 w-1 rounded-full" />
            Campus
          </p>
          <h1 className="text-ink mt-6 font-serif text-2xl leading-tight">
            {mode === 'signup' ? 'Tu cursada, ordenada.' : 'Bienvenido de vuelta.'}
          </h1>
          <p className="text-ink-muted mt-2 text-sm">
            {mode === 'signup'
              ? 'Plan de estudios, materias, entregas y correlativas en un solo lugar.'
              : 'Entrá para ver qué tenés hoy.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            required
          />

          <TextField
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            hint={mode === 'signup' ? 'Mínimo 6 caracteres.' : undefined}
            minLength={6}
            required
          />

          {error ? (
            <p role="alert" className="text-danger text-sm font-medium">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-1">
            {pending ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
          </Button>
        </form>

        <p className="text-ink-muted mt-6 text-sm">
          {mode === 'signup' ? '¿Ya tenés cuenta?' : '¿Todavía no tenés cuenta?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup')
              setError(null)
            }}
            className="text-accent-ink font-medium underline-offset-4 hover:underline"
          >
            {mode === 'signup' ? 'Entrá' : 'Creá una'}
          </button>
        </p>

        <p className="text-ink-muted mt-10 text-xs">
          Campus no te pide las credenciales de tu autogestión universitaria, y nunca lo va a
          hacer.{' '}
          <Link to="/settings" className="text-accent-ink underline underline-offset-4">
            Más info
          </Link>
        </p>
      </div>
    </main>
  )
}
