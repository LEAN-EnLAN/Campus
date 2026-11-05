import { createRootRoute, Outlet } from '@tanstack/react-router'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'

export const Route = createRootRoute({
  component: () => <Outlet />,
  // Outside the app shell, so it opts into the Campus Blue tokens itself (it
  // rendered in the legacy warm palette, under a blue illustration).
  notFoundComponent: () => (
    <div className="campus-blue min-h-dvh">
      <main className="mx-auto max-w-lg px-4 py-20">
        <EmptyState
          illustration="page-not-found"
          title="No encontramos esta página"
          description="El enlace puede estar viejo o mal escrito."
          action={
            <Button variant="primary" onClick={() => window.location.assign('/today')}>
              Ir a Hoy
            </Button>
          }
        />
      </main>
    </div>
  ),
})
