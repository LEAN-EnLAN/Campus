import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  countVisit,
  dismissOffer,
  INSTALL_OFFER_KEY,
  parseInstallOffer,
  shouldOfferInstall,
  SNOOZE_MS,
  VISIT_COUNTED_KEY,
} from './install-offer'
import { InstallOfferBanner } from './install-offer-banner'

const NOW = Date.UTC(2026, 10, 13, 12)

describe('when to offer "Agregar a inicio"', () => {
  it('never on the first visit', () => {
    expect(shouldOfferInstall(countVisit(parseInstallOffer(null)), NOW)).toBe(false)
  })

  it('from the second visit on', () => {
    const second = countVisit(countVisit(parseInstallOffer(null)))
    expect(shouldOfferInstall(second, NOW)).toBe(true)
  })

  it('not again for 30 days after "Ahora no", and again after that', () => {
    const dismissed = dismissOffer({ visits: 5, dismissedAt: null }, NOW)
    expect(shouldOfferInstall(dismissed, NOW + SNOOZE_MS - 1)).toBe(false)
    expect(shouldOfferInstall(dismissed, NOW + SNOOZE_MS)).toBe(true)
  })

  it('reads anything stored, even garbage, as a valid state', () => {
    expect(parseInstallOffer('{nope')).toEqual({ visits: 0, dismissedAt: null })
    expect(parseInstallOffer('{"visits":"3","dismissedAt":"ayer"}')).toEqual({
      visits: 0,
      dismissedAt: null,
    })
    expect(parseInstallOffer('{"visits":3,"dismissedAt":10}')).toEqual({
      visits: 3,
      dismissedAt: 10,
    })
  })
})

/** What Chromium fires when the page can be installed. */
function fireInstallable(outcome: 'accepted' | 'dismissed' = 'dismissed') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

/** A new browser session: what reopening the app tomorrow looks like. */
function newVisit() {
  window.sessionStorage.removeItem(VISIT_COUNTED_KEY)
}

describe('the banner', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
  })

  it('stays hidden on the first visit even when the browser can install', () => {
    render(<InstallOfferBanner />)
    const event = fireInstallable()

    expect(event.defaultPrevented).toBe(true)
    expect(screen.queryByText('Agregá Campus a tu pantalla de inicio')).toBeNull()
  })

  it('does not count a reload as a second visit', () => {
    render(<InstallOfferBanner />).unmount()
    render(<InstallOfferBanner />)
    fireInstallable()

    expect(screen.queryByText('Agregá Campus a tu pantalla de inicio')).toBeNull()
  })

  it('shows on the second visit and opens the browser prompt', async () => {
    const user = userEvent.setup()
    render(<InstallOfferBanner />).unmount()
    newVisit()
    render(<InstallOfferBanner />)
    const event = fireInstallable('accepted')

    await user.click(await screen.findByRole('button', { name: 'Agregar a inicio' }))

    expect(event.prompt).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Agregar a inicio' })).toBeNull()
  })

  it('is gone after "Ahora no", and stays gone on the next visit', async () => {
    const user = userEvent.setup()
    render(<InstallOfferBanner />).unmount()
    newVisit()
    const second = render(<InstallOfferBanner />)
    fireInstallable()

    await user.click(await screen.findByRole('button', { name: 'Ahora no' }))
    expect(screen.queryByText('Agregá Campus a tu pantalla de inicio')).toBeNull()
    second.unmount()

    newVisit()
    render(<InstallOfferBanner />)
    fireInstallable()
    expect(screen.queryByText('Agregá Campus a tu pantalla de inicio')).toBeNull()
    expect(
      parseInstallOffer(window.localStorage.getItem(INSTALL_OFFER_KEY)).dismissedAt,
    ).not.toBeNull()
  })

  it('renders nothing, without throwing, when storage is blocked', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    try {
      render(<InstallOfferBanner />)
      fireInstallable()
      expect(screen.queryByText('Agregá Campus a tu pantalla de inicio')).toBeNull()
    } finally {
      getItem.mockRestore()
    }
  })
})
