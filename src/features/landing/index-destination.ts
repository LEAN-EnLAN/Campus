/**
 * What `/` shows.
 *
 * The landing is for people who do not have Campus yet. That only happens on
 * the hosted web build: the desktop app and a local dev server open on a
 * folder the student already owns, so `/` there is always Hoy (P-01). On the
 * web, a signed-in student is a student, not a visitor, and also goes to Hoy.
 *
 * `wait` exists because the session check is async: deciding before it
 * answers would flash the landing at a student who is about to be sent away.
 */
export type IndexDestination = 'today' | 'landing' | 'wait'

export function indexDestination(input: {
  vaultAvailable: boolean
  signedIn: boolean
  authLoading: boolean
}): IndexDestination {
  if (input.vaultAvailable) return 'today'
  if (input.authLoading) return 'wait'
  return input.signedIn ? 'today' : 'landing'
}
