import { createContext, use, type ReactNode } from 'react'

/**
 * Does this runtime need an account?
 *
 * Routes are allowed to ask THIS, and not `mode === 'local'`. The difference is
 * not cosmetic: "which world am I in" is a decision that belongs to the
 * composition root and leaks everywhere once a screen learns it, while "does
 * the student need to be signed in" is a capability question a guard genuinely
 * has to answer.
 *
 * It exists because "no session" stopped meaning "go to login". A student with
 * a vault and no account is a first-class user, and `_app.tsx` used to send
 * them to a login screen they can never satisfy.
 */
const RequiresAccountContext = createContext<boolean | null>(null)

export function RequiresAccountProvider({
  value,
  children,
}: {
  value: boolean
  children: ReactNode
}) {
  return <RequiresAccountContext value={value}>{children}</RequiresAccountContext>
}

export function useRequiresAccount(): boolean {
  const value = use(RequiresAccountContext)
  // Defaulting to `true` outside a provider keeps the cloud POC's guard intact
  // for any tree that renders routes without a runtime.
  return value ?? true
}
