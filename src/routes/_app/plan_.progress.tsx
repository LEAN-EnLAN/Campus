import { createFileRoute } from '@tanstack/react-router'

import { ProgressEntryScreen } from '@/features/academic/progress-entry-screen'

/**
 * "Cargar mi avance". The trailing underscore in `plan_` keeps this route out
 * from under `plan.tsx`, which is a leaf screen with no <Outlet />.
 */
export const Route = createFileRoute('/_app/plan_/progress')({
  component: ProgressEntryScreen,
})
