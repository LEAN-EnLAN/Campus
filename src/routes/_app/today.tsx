import { createFileRoute } from '@tanstack/react-router'

import { BlueTodayScreen } from '@/features/blue/blue-today-screen'

export const Route = createFileRoute('/_app/today')({
  component: BlueTodayScreen,
})
