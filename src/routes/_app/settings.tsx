import { createFileRoute } from '@tanstack/react-router'

import { SettingsScreen } from '@/features/settings/settings-screen'
import '@/styles/blue-secondary.css'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsScreen,
})
