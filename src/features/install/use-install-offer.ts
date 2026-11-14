import { useState, useSyncExternalStore } from 'react'

import {
  countVisit,
  dismissOffer,
  INSTALL_OFFER_KEY,
  parseInstallOffer,
  shouldOfferInstall,
  VISIT_COUNTED_KEY,
  type InstallOfferState,
} from './install-offer'

/** Chromium's install event. Not in the DOM typings: no other engine fires it. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// The browser fires `beforeinstallprompt` once, whenever it decides the page is
// installable — often before the shell has mounted. It is caught at module
// load and held here, so a late-mounting screen still gets it.
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function setDeferred(next: BeforeInstallPromptEvent | null) {
  deferred = next
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Our own offer replaces the browser's mini-infobar, which would show on
    // the first visit too.
    event.preventDefault()
    setDeferred(event as BeforeInstallPromptEvent)
  })
  window.addEventListener('appinstalled', () => setDeferred(null))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Storage can be missing or throw (private mode, blocked site data). Every
// access is guarded; without storage the offer simply never shows.
function readState(): InstallOfferState {
  try {
    return parseInstallOffer(window.localStorage.getItem(INSTALL_OFFER_KEY))
  } catch {
    return parseInstallOffer(null)
  }
}

function writeState(state: InstallOfferState) {
  try {
    window.localStorage.setItem(INSTALL_OFFER_KEY, JSON.stringify(state))
  } catch {
    /* nothing to remember it in: the offer stays hidden */
  }
}

/** Counts this visit once per browser session: a reload is not a second visit. */
function recordVisit(): InstallOfferState {
  const state = readState()
  try {
    if (window.sessionStorage.getItem(VISIT_COUNTED_KEY)) return state
    window.sessionStorage.setItem(VISIT_COUNTED_KEY, '1')
  } catch {
    return state
  }
  const next = countVisit(state)
  writeState(next)
  return next
}

/** "Agregar a inicio": whether to show it, and what its two buttons do. */
export function useInstallOffer() {
  // Lazy and idempotent (the session flag), so StrictMode's double call counts once.
  const [state, setState] = useState(recordVisit)
  const [now] = useState(() => Date.now())
  const event = useSyncExternalStore(
    subscribe,
    () => deferred,
    () => null,
  )

  function dismiss() {
    const next = dismissOffer(state, Date.now())
    writeState(next)
    setState(next)
  }

  async function install() {
    const prompt = deferred
    if (!prompt) return
    // A prompt can be shown once; after this the browser decides whether to fire another.
    setDeferred(null)
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'dismissed') dismiss()
  }

  return {
    visible: event !== null && shouldOfferInstall(state, now),
    install: () => void install(),
    dismiss,
  }
}
