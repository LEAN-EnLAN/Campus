/**
 * Product metrics: how many people use a feature, never what they wrote.
 *
 * `track()` is a plain function so any handler can call it after the action it
 * measures, without a hook and without waiting. It does nothing until a Cloud
 * session with consent installs a recorder (see `TelemetryBridge`): in Local
 * mode, signed out, or without consent there is no recorder and no network.
 *
 * Contract shared with the other work packages — keep the signature stable:
 *   track(name, props?) → void. Never throws, never blocks the action.
 */

export type EventName = 'share_copied' | 'share_saved'

export interface TrackProps {
  /** Random per-share token (8–32 of `A-Za-z0-9_-`). Never derived from the user. */
  ref?: string
}

/** Sends one event somewhere. Installed per session; `null` means "measure nothing". */
export type TrackRecorder = (name: EventName, props: TrackProps) => Promise<void>

let recorder: TrackRecorder | null = null

/** Install (or remove, with `null`) the recorder for the current session. */
export function setTrackRecorder(next: TrackRecorder | null): void {
  recorder = next
}

export function track(name: EventName, props?: { ref?: string }): void {
  const current = recorder
  if (!current) return
  try {
    // Fire and forget: a metric must never cost the student a failed action.
    current(name, { ...props }).catch(() => undefined)
  } catch {
    // A recorder that throws synchronously is ignored the same way.
  }
}

/**
 * A recorder that asks for consent on every event, so switching it off in
 * Ajustes stops the very next event — not the next session.
 */
export function consentGatedRecorder(deps: {
  /** The student's current choice. Rejecting counts as "no". */
  hasConsent: () => Promise<boolean>
  record: (name: EventName, ref: string | null) => Promise<void>
}): TrackRecorder {
  return async (name, props) => {
    const consent = await deps.hasConsent().catch(() => false)
    if (!consent) return
    await deps.record(name, props.ref ?? null)
  }
}
