import type { CampusBackend } from '@/lib/backends/types'
import type { VaultAccess } from '@/lib/vault/vault-access'

/**
 * LOCAL-004 — which world Campus is running in, decided once.
 *
 * Downstream code never learns the answer. A `if (mode === 'local')` inside a
 * route or a component means this decision leaked, and the seam is in the wrong
 * place — see `docs/adr/ADR-local-first-backend.md`.
 */
export type CampusRuntime =
  | {
      mode: 'local'
      vault: VaultDescriptor
      backend: CampusBackend
      /**
       * The raw file capability, for the workspace. Carried on the runtime so
       * the composition root can hand it to FilesProvider — screens still never
       * import the vault; they ask `useFiles()`, which is null in cloud mode.
       */
      access: VaultAccess
    }
  | { mode: 'cloud'; backend: CampusBackend }

/** A vault the student chose, as the DEVICE knows it. */
export interface VaultDescriptor {
  /** Absolute path on this machine. Device-scoped, and never written into the vault. */
  path: string
  /** What to call it in the picker. Defaults to the folder name. */
  name: string
}

/**
 * What startup actually found — and the reason this is a union rather than a
 * boolean.
 *
 * "No session" used to mean "go to login". It cannot mean that any more: a
 * student with a vault and no account is a first-class user, and a student
 * whose vault folder was moved has a problem that login does not solve.
 *
 * `resolving` and `needs-choice` are DIFFERENT states. Collapsing them shows a
 * picker for a frame before the saved runtime loads, or worse, treats "still
 * looking" as "nothing configured" and quietly discards a working setup.
 */
export type StartupState =
  /** Still looking. Render nothing conclusive: this is not an answer. */
  | { status: 'resolving' }
  /** A runtime was resolved and the app can mount. */
  | { status: 'ready'; runtime: CampusRuntime }
  /** Nothing is configured. First run, or the student signed out of everything. */
  | { status: 'needs-choice' }
  /**
   * A vault was remembered and is no longer there.
   *
   * Distinct from `needs-choice` on purpose: the student had a working setup,
   * so they get an explanation and the chance to point at where it went — not a
   * blank first-run screen, not a login redirect, and above all not a silently
   * recreated empty folder where their notes used to be.
   */
  | { status: 'vault-missing'; vault: VaultDescriptor }
  /**
   * A vault was remembered and we could not get to it — the check failed, or
   * the folder is there and refused to open.
   *
   * Distinct from `vault-missing` for the same reason `prerequisitesKnown`
   * exists: not knowing is not the same as knowing there is nothing. Telling a
   * student their folder moved, when what actually happened is that a request
   * failed, sends them searching their disk for a problem that is not there.
   */
  | { status: 'vault-unavailable'; vault: VaultDescriptor; reason: string }
