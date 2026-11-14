import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useAuth } from '@/features/auth/auth-context'
import { useBackend } from '@/lib/backends/context'
import { consentGatedRecorder, setTrackRecorder } from '@/lib/telemetry/track'

import { readMetricsConsent } from './queries'

/**
 * Connects `track()` to the current session, or disconnects it.
 *
 * A recorder exists only for a signed-in Cloud session whose backend can
 * record events. Local workspaces, signed-out screens and tests get none, so
 * `track()` stays a no-op there without knowing why.
 */
export function TelemetryBridge() {
  const backend = useBackend()
  const queryClient = useQueryClient()
  const { userId } = useAuth()

  useEffect(() => {
    const { profile, telemetry } = backend
    if (!profile || !telemetry || !userId) {
      setTrackRecorder(null)
      return
    }
    setTrackRecorder(
      consentGatedRecorder({
        hasConsent: () => readMetricsConsent(queryClient, profile),
        record: (name, ref) => telemetry.record(name, ref),
      }),
    )
    return () => setTrackRecorder(null)
  }, [backend, queryClient, userId])

  return null
}
