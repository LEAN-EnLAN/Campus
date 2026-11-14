/**
 * When to offer "Agregar a inicio".
 *
 * Not on the first visit: someone who just arrived has not decided Campus is
 * worth a spot on their home screen. From the second visit on, as long as the
 * browser says it can install; and a "Ahora no" is respected for 30 days.
 *
 * Pure: the hook reads and writes storage, this only decides.
 */

export const INSTALL_OFFER_KEY = 'campus.install-offer'
/** Set for the rest of the browser session once this visit was counted. */
export const VISIT_COUNTED_KEY = 'campus.install-offer.visit-counted'

export const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000
const MIN_VISITS = 2

export interface InstallOfferState {
  visits: number
  /** Epoch ms of the last "Ahora no", or null. */
  dismissedAt: number | null
}

const EMPTY: InstallOfferState = { visits: 0, dismissedAt: null }

/** Whatever is stored, even garbage, reads as a valid state. */
export function parseInstallOffer(raw: string | null): InstallOfferState {
  if (!raw) return EMPTY
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return EMPTY
    const { visits, dismissedAt } = value as Record<string, unknown>
    return {
      visits: typeof visits === 'number' && Number.isFinite(visits) && visits > 0 ? visits : 0,
      dismissedAt:
        typeof dismissedAt === 'number' && Number.isFinite(dismissedAt) ? dismissedAt : null,
    }
  } catch {
    return EMPTY
  }
}

export function countVisit(state: InstallOfferState): InstallOfferState {
  return { ...state, visits: state.visits + 1 }
}

export function dismissOffer(state: InstallOfferState, now: number): InstallOfferState {
  return { ...state, dismissedAt: now }
}

export function shouldOfferInstall(state: InstallOfferState, now: number): boolean {
  if (state.visits < MIN_VISITS) return false
  return state.dismissedAt === null || now - state.dismissedAt >= SNOOZE_MS
}
