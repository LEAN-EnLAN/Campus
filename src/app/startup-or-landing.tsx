import { useAuth } from '@/features/auth/auth-context'
import { indexDestination } from '@/features/landing/index-destination'
import { LandingLazy } from '@/features/landing/index-screen'
import { useRuntime } from '@/lib/runtime/context'

import { Startup } from './startup'

/**
 * What renders before a runtime is ready.
 *
 * On the hosted build a first-time visitor has no runtime yet (`needs-choice`),
 * so the router — and with it the `/` route — never mounts. Without this, the
 * landing would be unreachable for exactly the people it is for. Every other
 * path and every other state keeps the startup screen it had.
 */
export function StartupOrLanding({
  pathname = window.location.pathname,
}: {
  pathname?: string
}) {
  const { vaultAvailable, state } = useRuntime()
  const { session, loading } = useAuth()

  const landing =
    pathname === '/' &&
    state.status === 'needs-choice' &&
    indexDestination({ vaultAvailable, signedIn: session !== null, authLoading: loading }) ===
      'landing'

  return landing ? <LandingLazy /> : <Startup />
}
