/**
 * "Tu cuenta y tus datos fueron borrados" has to outlive the screen that said
 * it: deleting the account signs out and leaves the app shell (and its toast)
 * behind. One flag in sessionStorage carries it to the login screen, once.
 */

const KEY = 'campus.accountDeleted'

export const ACCOUNT_DELETED_MESSAGE = 'Tu cuenta y tus datos fueron borrados'

export function rememberAccountDeleted(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* storage unavailable: the student just does not see the confirmation */
  }
}

/** True once after a deletion, then false. */
export function takeAccountDeleted(): boolean {
  try {
    const present = sessionStorage.getItem(KEY) === '1'
    sessionStorage.removeItem(KEY)
    return present
  } catch {
    return false
  }
}
