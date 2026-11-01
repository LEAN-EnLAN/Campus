import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'

import { useRequiresAccount } from '@/lib/runtime/identity'

import { useAuth } from './auth-context'

/** Mount inside the runtime so closing a workspace also retires its cache. */
export function WorkspaceQueryProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const requiresAccount = useRequiresAccount()
  return (
    <QueryScope key={requiresAccount ? `cloud:${userId ?? 'signed-out'}` : 'local'}>
      {children}
    </QueryScope>
  )
}

function QueryScope({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  )
  useEffect(() => () => client.clear(), [client])
  // Remount observers too: their query functions and mutation callbacks capture
  // this identity's client. Late completions can only reach the retired cache.
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
