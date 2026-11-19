import { Navigate } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import { useAuth } from '@/features/auth/auth-context'
import { useRuntime } from '@/lib/runtime/context'

import { indexDestination } from '@/features/landing/index-destination'

/** Lazy: the desktop app and signed-in students never download the landing. */
const LandingPage = lazy(() =>
  import('@/features/landing/landing-page').then((module) => ({ default: module.LandingPage })),
)

export function LandingLazy() {
  return (
    <Suspense fallback={null}>
      <LandingPage />
    </Suspense>
  )
}

/** `/`: Hoy for students, the landing for visitors of the hosted web build. */
export function IndexScreen() {
  const { vaultAvailable } = useRuntime()
  const { session, loading } = useAuth()
  const destination = indexDestination({
    vaultAvailable,
    signedIn: session !== null,
    authLoading: loading,
  })

  if (destination === 'today') return <Navigate to="/today" replace />
  if (destination === 'wait') return null
  return <LandingLazy />
}
