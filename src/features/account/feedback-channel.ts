import type { CampusBackend } from '@/lib/backends/types'

/**
 * Where a Local student writes to us (`VITE_CAMPUS_FEEDBACK_EMAIL`). A build
 * without it offers no "Contanos algo" in Local at all, rather than a mail
 * link that goes nowhere.
 */
export const FEEDBACK_EMAIL: string | null =
  import.meta.env.VITE_CAMPUS_FEEDBACK_EMAIL?.trim() || null

/** Cloud sends from the app; Local only has the mail link, if the build has one. */
export function feedbackAvailable(backend: CampusBackend): boolean {
  return Boolean(backend.feedback) || FEEDBACK_EMAIL !== null
}
