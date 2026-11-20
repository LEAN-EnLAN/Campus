import { createFileRoute, redirect } from '@tanstack/react-router'

import { SettingsScreen } from '@/features/settings/settings-screen'
import {
  parseSettingsSearch,
  sectionFromLegacyHash,
} from '@/features/settings/settings-sections'

export const Route = createFileRoute('/_app/settings')({
  // `?seccion=apariencia` opens one section; anything else is dropped.
  validateSearch: parseSettingsSearch,
  // The old one-page Ajustes was addressed by anchors (`#asistente`): send them
  // to the section that holds that content now.
  beforeLoad: ({ location, search }) => {
    const legacy = search.seccion ? null : sectionFromLegacyHash(location.hash)
    if (legacy) throw redirect({ to: '/settings', search: { seccion: legacy }, replace: true })
  },
  component: SettingsScreen,
})
