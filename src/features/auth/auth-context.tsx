import type { Session } from '@supabase/supabase-js'
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'

import { supabase } from '@/lib/supabase'

interface AuthValue {
  session: Session | null
  userId: string | null
  /** True until the first session check resolves — routes must not redirect before this. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

/** Supabase error messages are in English; students are not. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('user already registered')) return 'Ya existe una cuenta con ese email.'
  if (m.includes('password should be at least'))
    return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (m.includes('unable to validate email')) return 'Revisá el email, no parece válido.'
  if (
    m.includes('email rate limit') ||
    m.includes('rate limit') ||
    m.includes('for security purposes')
  )
    return 'Demasiados intentos. Probá de nuevo en un rato.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled'))
    return 'El registro de cuentas está deshabilitado por ahora.'
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'No pudimos conectarnos. Revisá tu conexión.'
  return 'No pudimos completar la operación. Probá de nuevo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      userId: session?.user.id ?? null,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error ? translateAuthError(error.message) : null }
      },
      signUp: async (email, password, displayName) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            // The confirmation link must come back to wherever Campus is served
            // from, not to the project's configured Site URL (a localhost
            // default until someone edits it). The origin must also be listed in
            // the project's Redirect URLs — see docs/DEPLOY.md.
            emailRedirectTo: `${window.location.origin}/login`,
          },
        })
        if (error) return { error: translateAuthError(error.message), needsConfirmation: false }
        // With "Confirm email" on, the account exists but there is no session
        // until the link is followed.
        return { error: null, needsConfirmation: data.session === null }
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthValue {
  const value = use(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return value
}
