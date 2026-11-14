/**
 * Product events, counted only with the student's consent.
 *
 * STUB: WP2 owns this file and replaces the body with the real implementation
 * (consent from the profile, insert into `product_events`). The contract is
 * fixed and shared; until then this does nothing.
 *
 * Never throws and never blocks the action that called it.
 */
export type EventName = 'share_copied' | 'share_saved'

export function track(name: EventName, props?: { ref?: string }): void {
  void name
  void props
}
