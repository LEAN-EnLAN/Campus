import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AuthProvider } from '@/features/auth/auth-context'
import { RuntimeProvider } from '@/lib/runtime/context'
import { ThemeProvider } from '@/lib/theme/theme-context'
import '@/styles/globals.css'

import { resolveRuntimeCapabilities } from './runtime-capabilities'
import { Startup } from './startup'

import { routeTree } from '../routeTree.gen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Built once, outside render: RuntimeProvider re-resolves whenever this
// identity changes, and a fresh object every render would re-resolve forever.
const capabilities = resolveRuntimeCapabilities()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('No se encontró el elemento #root')

createRoot(rootElement).render(
  <StrictMode>
    {/* Outermost: the palette applies to the startup picker and to every error
        state too, not only to screens that made it past the router. */}
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* The composition root. RuntimeProvider decides local or cloud once,
            renders the picker until it can, and hands the resolved backend to
            BackendProvider — so both modes reach the SAME router below. */}
          <RuntimeProvider capabilities={capabilities} fallback={() => <Startup />}>
            <RouterProvider router={router} />
          </RuntimeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
