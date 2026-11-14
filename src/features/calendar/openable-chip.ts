import type { KeyboardEvent } from 'react'

/**
 * A chip is reachable and opened from the keyboard, too.
 *
 * The vendor's event box is not focusable, so the chip is: Enter or Space
 * CLICKS it, and the click bubbles to the event box exactly as a pointer's
 * would — one path into the detail dialog, not a second one to keep in sync.
 */
export const openableChip = {
  role: 'button',
  tabIndex: 0,
  'aria-haspopup': 'dialog',
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.currentTarget.click()
  },
} as const
