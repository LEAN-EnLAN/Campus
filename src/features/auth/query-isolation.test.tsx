import type { Session } from '@supabase/supabase-js'
import { useQueries, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type * as ReactDomClient from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '@/lib/query-keys'
import { useRuntime } from '@/lib/runtime/context'
import { useAuth } from './auth-context'

const fixture = vi.hoisted(() => ({
  tree: null as ReactNode,
  mode: 'cloud' as 'cloud' | 'local',
  listener: (_event: string, _session: Session | null) => {},
  probe: () => null as ReactNode,
}))
vi.mock('react-dom/client', async (original) => {
  const actual = await original<typeof ReactDomClient>()
  return {
    ...actual,
    createRoot: (...args: Parameters<typeof actual.createRoot>) =>
      (args[0] as HTMLElement).id === 'root'
        ? { render: (tree: ReactNode) => (fixture.tree = tree) }
        : actual.createRoot(...args),
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'A' } } } }),
      onAuthStateChange: (listener: typeof fixture.listener) => {
        fixture.listener = listener
        return { data: { subscription: { unsubscribe() {} } } }
      },
      signOut: async () => fixture.listener('SIGNED_OUT', null),
    },
  },
}))
vi.mock('@/app/runtime-capabilities', () => ({
  resolveRuntimeCapabilities: () => ({
    vaultAvailable: true,
    store: {
      get: () =>
        JSON.stringify({
          recentVaults: [],
          lastRuntime: { mode: fixture.mode, path: '/vault' },
        }),
      set() {},
    },
    cloudSession: async () => true,
    vaultExists: async () => true,
    openCloud: async () => ({ mode: 'cloud', backend: {} }),
    openLocal: async () => ({
      mode: 'local',
      backend: {},
      access: {},
      vault: { path: '/vault', name: 'Vault' },
    }),
  }),
}))
vi.mock('@/lib/theme/theme-context', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/app/startup', () => ({ Startup: () => null }))
vi.mock('@/routeTree.gen', () => ({ routeTree: {} }))
vi.mock('@tanstack/react-router', () => ({
  createRouter: () => ({ navigate: async () => {} }),
  RouterProvider: () => fixture.probe(),
}))

const keys = [queryKeys.academicContext, queryKeys.academicItems, queryKeys.resources]
let current!: {
  client: QueryClient
  auth: ReturnType<typeof useAuth>
  runtime: ReturnType<typeof useRuntime>
}
let seen: { user: string | null; data: unknown[] }[]
function Probe() {
  const auth = useAuth()
  const client = useQueryClient()
  const runtime = useRuntime()
  const queries = useQueries({
    queries: keys.map((queryKey) => ({
      queryKey,
      queryFn: async () => `${fixture.mode === 'local' ? 'local' : auth.userId}:${queryKey[0]}`,
      enabled: fixture.mode === 'local' || !!auth.userId,
    })),
  })
  current = { auth, client, runtime }
  seen.push({ user: auth.userId, data: queries.map((q) => q.data) })
  return null
}
async function identity(user: string | null) {
  await act(async () =>
    fixture.listener(
      user ? 'SIGNED_IN' : 'SIGNED_OUT',
      user ? ({ user: { id: user } } as Session) : null,
    ),
  )
}
async function ready(owner: string) {
  await waitFor(() =>
    expect(keys.map((key) => current.client.getQueryData(key))).toEqual(
      keys.map((key) => `${owner}:${key[0]}`),
    ),
  )
}

beforeAll(async () => {
  const element = document.createElement('div')
  element.id = 'root'
  document.body.append(element)
  await import('@/app/app-entry')
  element.remove()
})
beforeEach(() => {
  fixture.mode = 'cloud'
  fixture.probe = Probe
  seen = []
})
afterEach(() => current?.client.clear())

describe('app query ownership across auth transitions', () => {
  it('never renders fresh A context, items or resources after sign-out and B sign-in', async () => {
    render(fixture.tree)
    await ready('A')
    await act(async () => current.auth.signOut())
    await identity('B')
    await ready('B')
    expect(
      seen.filter((entry) => entry.user !== 'A').flatMap((entry) => entry.data),
    ).not.toContain('A:academic-context')
    expect(
      seen.filter((entry) => entry.user !== 'A').flatMap((entry) => entry.data),
    ).not.toContain('A:academic-items')
    expect(
      seen.filter((entry) => entry.user !== 'A').flatMap((entry) => entry.data),
    ).not.toContain('A:resources')
  })

  it('isolates late A queries and mutation callbacks from B and a later A session', async () => {
    render(fixture.tree)
    await ready('A')
    const old = current.client
    let finishQuery!: (value: string) => void
    let finishMutation!: (value: string) => void
    const query = old
      .fetchQuery({
        queryKey: ['late'],
        queryFn: () =>
          new Promise<string>((resolve) => {
            finishQuery = resolve
          }),
      })
      .catch(() => undefined)
    const mutation = old
      .getMutationCache()
      .build(old, {
        mutationFn: () =>
          new Promise<string>((resolve) => {
            finishMutation = resolve
          }),
        onSuccess: (value) => {
          old.setQueryData(queryKeys.resources, value)
        },
      })
      .execute(undefined)
    await act(async () => {
      await Promise.resolve()
    })
    await identity(null)
    await identity('B')
    await act(async () => {
      finishQuery('A:late')
      finishMutation('A:late-mutation')
      await Promise.all([query, mutation])
    })
    expect(current.client.getQueryData(['late'])).toBeUndefined()
    expect(current.client.getQueryData(queryKeys.resources)).toBe('B:resources')
    await identity('A')
    await ready('A')
    expect(current.client.getQueryData(['late'])).toBeUndefined()
  })

  it('preserves local cache and mounted state across unrelated cloud auth events', async () => {
    fixture.mode = 'local'
    render(fixture.tree)
    await ready('local')
    const local = current.client
    local.setQueryData(['draft'], 'local draft')
    await identity(null)
    await identity('B')
    expect(current.client).toBe(local)
    expect(current.client.getQueryData(['draft'])).toBe('local draft')
  })

  it('retains same-user refreshes but discards cache on workspace close', async () => {
    render(fixture.tree)
    await ready('A')
    const client = current.client
    client.setQueryData(['draft'], 'private')
    await identity('A')
    expect(current.client).toBe(client)
    const runtime = current.runtime
    await act(async () => runtime.changeWorkspace())
    await act(async () => runtime.chooseCloud())
    await ready('A')
    expect(current.client.getQueryData(['draft'])).toBeUndefined()
  })
})
