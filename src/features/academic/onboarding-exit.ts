/**
 * The way out of the onboarding screen, in its top bar.
 *
 * "Volver a ajustes" only when the student actually came from Ajustes (they are
 * changing their carrera). A brand-new student who just saved their plan never
 * saw Ajustes; offering to go "back" there sent them somewhere they had never
 * been. Anyone else who already has a plan goes to Hoy. Before a first save
 * there is no way out: the app would only send them back here.
 */
export type OnboardingExit =
  { to: '/settings'; label: 'Volver a ajustes' } | { to: '/today'; label: 'Ir a Hoy' }

export type OnboardingOrigin = 'settings'

export function onboardingExit({
  from,
  hasContext,
}: {
  from: OnboardingOrigin | undefined
  /** A plan is saved — before this visit, or by it. */
  hasContext: boolean
}): OnboardingExit | null {
  if (!hasContext) return null
  if (from === 'settings') return { to: '/settings', label: 'Volver a ajustes' }
  return { to: '/today', label: 'Ir a Hoy' }
}

/** `?from=settings`, and nothing else, survives the URL. */
export function parseOnboardingSearch(search: Record<string, unknown>): {
  from?: OnboardingOrigin
} {
  return search.from === 'settings' ? { from: 'settings' } : {}
}
