import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { useAuth } from './auth-context'

export const SIGN_OUT_ERROR = 'No pudimos cerrar la sesión. Intentá de nuevo.'

/**
 * End the Cloud session and leave for /login. Shared by the account menu and the
 * Settings account card so both report the same pending state and error text.
 * Resolves to the error message, or null on success.
 */
export function useSignOut() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(): Promise<string | null> {
    if (pending) return null
    setPending(true)
    setError(null)
    try {
      await signOut()
      void navigate({ to: '/login' })
      return null
    } catch {
      setError(SIGN_OUT_ERROR)
      return SIGN_OUT_ERROR
    } finally {
      setPending(false)
    }
  }

  return { signOut: run, pending, error }
}
