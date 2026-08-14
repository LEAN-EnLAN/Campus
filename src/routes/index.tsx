import { createFileRoute, redirect } from '@tanstack/react-router'

/** `/` always lands on Today (P-01). */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/today' })
  },
})
