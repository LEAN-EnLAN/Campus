/**
 * The real app. Loaded by `main.tsx` ONLY when the build is configured: importing
 * this pulls in `src/lib/supabase.ts`, which throws without its env values.
 */
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { TelemetryBridge } from '@/features/account/telemetry-bridge'
import { AuthProvider } from '@/features/auth/auth-context'
import { WorkspaceQueryProvider } from '@/features/auth/workspace-query-provider'
import { RuntimeProvider } from '@/lib/runtime/context'
import { ThemeProvider } from '@/lib/theme/theme-context'

import { resolveRuntimeCapabilities } from './runtime-capabilities'
import { Startup } from './startup'

import { routeTree } from '../routeTree.gen'

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

/**
 * Cache lifetime belongs to WorkspaceQueryProvider below the runtime. Point the
 * router at Hoy because the next workspace may not have the previous screen.
 */
function leftWorkspace() {
  void router.navigate({ to: '/today', replace: true })
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('No se encontró el elemento #root')

createRoot(rootElement).render(
  <StrictMode>
    {/* Outermost: the palette applies to the startup picker and to every error
        state too, not only to screens that made it past the router. */}
    <ThemeProvider>
      <AuthProvider>
        {/* The composition root. RuntimeProvider decides local or cloud once,
            renders the picker until it can, and hands the resolved backend to
            BackendProvider — so both modes reach the SAME router below. */}
        <RuntimeProvider
          capabilities={capabilities}
          fallback={() => <Startup />}
          onWorkspaceClosed={leftWorkspace}
        >
          <WorkspaceQueryProvider>
            <TelemetryBridge />
            <RouterProvider router={router} />
          </WorkspaceQueryProvider>
        </RuntimeProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
