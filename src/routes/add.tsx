import { createFileRoute, redirect } from '@tanstack/react-router'

import { acceptSharedCapture } from '@/features/items/share'

/**
 * `/add?kind=…&title=…` — a date someone shared. Public: it only keeps the
 * checked fields for Hoy, which opens them as a draft. Without a session the
 * app's guard sends the student to log in, and back to Hoy after.
 */
export const Route = createFileRoute('/add')({
  beforeLoad: ({ location }) => {
    acceptSharedCapture(location.searchStr)
    throw redirect({ to: '/today' })
  },
})
