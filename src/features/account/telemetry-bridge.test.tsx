import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BackendProvider } from '@/lib/backends/context'
import type { CampusBackend } from '@/lib/backends/types'
import { setTrackRecorder, track } from '@/lib/telemetry/track'

import { TelemetryBridge } from './telemetry-bridge'

const auth = vi.hoisted(() => ({ userId: 'user-1' as string | null }))
vi.mock('@/features/auth/auth-context', () => ({ useAuth: () => auth }))

afterEach(() => {
  setTrackRecorder(null)
  auth.userId = 'user-1'
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function cloudBackend(consent: boolean) {
  const record = vi.fn(async () => undefined)
  const backend = {
    kind: 'cloud',
    profile: {
      get: async () => ({ metricsConsent: consent, metricsConsentAt: null }),
      setMetricsConsent: async () => undefined,
    },
    telemetry: { record },
  } as unknown as CampusBackend
  return { backend, record }
}

function mount(backend: CampusBackend) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <BackendProvider backend={backend}>
        <TelemetryBridge />
      </BackendProvider>
    </QueryClientProvider>,
  )
}

describe('TelemetryBridge', () => {
  it('records with consent in a signed-in Cloud session', async () => {
    const { backend, record } = cloudBackend(true)
    mount(backend)
    track('share_copied', { ref: 'abcdefgh' })
    await settle()
    await settle()
    expect(record).toHaveBeenCalledWith('share_copied', 'abcdefgh')
  })

  it('records nothing without consent', async () => {
    const { backend, record } = cloudBackend(false)
    mount(backend)
    track('share_copied', { ref: 'abcdefgh' })
    await settle()
    await settle()
    expect(record).not.toHaveBeenCalled()
  })

  it('records nothing signed out', async () => {
    auth.userId = null
    const { backend, record } = cloudBackend(true)
    mount(backend)
    track('share_saved', { ref: 'abcdefgh' })
    await settle()
    expect(record).not.toHaveBeenCalled()
  })

  it('installs nothing for a Local workspace, and unmounting removes the recorder', async () => {
    const { backend, record } = cloudBackend(true)
    const view = mount(backend)
    view.unmount()
    track('share_saved', { ref: 'abcdefgh' })
    await settle()
    expect(record).not.toHaveBeenCalled()

    mount({ kind: 'local' } as unknown as CampusBackend)
    expect(() => track('share_saved')).not.toThrow()
  })
})
