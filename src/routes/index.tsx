import { createFileRoute } from '@tanstack/react-router'

import { IndexScreen } from '@/app/index-screen'

/**
 * `/` is Today (P-01) for anyone who uses Campus: the desktop app, a local
 * server, a signed-in student. Only a visitor of the hosted web build sees the
 * landing — see `indexDestination`.
 */
export const Route = createFileRoute('/')({
  component: IndexScreen,
})
