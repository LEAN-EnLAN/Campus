import type { Session } from '@supabase/supabase-js'
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'

import { supabase } from '@/lib/supabase'

import { translateAuthError } from './auth-errors'

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
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          return { error: error ? translateAuthError(error.message, navigator.onLine) : null }
        } catch (cause) {
          // A fetch that throws instead of returning an error is still "no answer".
          return { error: translateAuthError(String(cause), navigator.onLine) }
        }
      },
      signUp: async (email, password, displayName) => {
        let result
        try {
          result = await supabase.auth.signUp({
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
        } catch (cause) {
          return {
            error: translateAuthError(String(cause), navigator.onLine),
            needsConfirmation: false,
          }
        }
        const { data, error } = result
        if (error) {
          return {
            error: translateAuthError(error.message, navigator.onLine),
            needsConfirmation: false,
          }
        }
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
