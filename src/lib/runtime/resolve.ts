import { readDeviceConfig, type DeviceStore } from './device-config'
import type { CampusRuntime, StartupState, VaultDescriptor } from './types'

/**
 * LOCAL-004 — the ONE place a runtime is chosen.
 *
 * Everything downstream receives an already-decided `CampusRuntime`. If a second
 * place learns how to pick one, this stops being a decision and becomes a
 * convention, and conventions are what leave `if (mode === 'local')` scattered
 * across routes three weeks later.
 *
 * Deliberately pure of React, of Supabase and of the filesystem: it asks
 * questions through injected capabilities and returns a state. That is what
 * makes every branch below testable without a browser.
 */

export interface RuntimeCapabilities {
  /** Device-scoped preferences: recent vaults, last runtime. */
  store: DeviceStore
  /** Is this vault still on disk, and does it look like a vault? */
  vaultExists(path: string): Promise<boolean>
  /** Build the local runtime for a vault that has already been verified. */
  openLocal(vault: VaultDescriptor): Promise<CampusRuntime>
  /** Is there a usable cloud session right now? */
  cloudSession(): Promise<boolean>
  /** Build the cloud runtime. */
  openCloud(): Promise<CampusRuntime>
}

/**
 * Decide what startup should show.
 *
 * The order encodes a claim: a student who last used a vault gets their vault,
 * even if a cloud session also happens to be valid. Reopening the cloud because
 * a token was still fresh would silently move someone off their own files.
 */
export async function resolveCampusRuntime(caps: RuntimeCapabilities): Promise<StartupState> {
  const config = readDeviceConfig(caps.store)
  const last = config.lastRuntime

  if (last?.mode === 'local') {
    const remembered =
      config.recentVaults.find((v) => v.path === last.path) ?? descriptorFor(last.path)

    if (await caps.vaultExists(last.path)) {
      return { status: 'ready', runtime: await caps.openLocal(remembered) }
    }

    // The folder moved, the drive is unplugged, the student renamed it. This is
    // NOT "nothing configured", and it is emphatically not a reason to create a
    // folder or to send them to login: their notes exist somewhere, and the only
    // honest move is to say so and let them point at it.
    return { status: 'vault-missing', vault: remembered }
  }

  if (last?.mode === 'cloud') {
    if (await caps.cloudSession()) {
      return { status: 'ready', runtime: await caps.openCloud() }
    }
    // An expired cloud session is the one case where login IS the answer — but
    // the picker owns that decision, not this function, so it reports the same
    // "nothing usable" state and lets the student choose again.
    return { status: 'needs-choice' }
  }

  return { status: 'needs-choice' }
}

/** A descriptor for a path we remember but have no stored name for. */
export function descriptorFor(path: string): VaultDescriptor {
  const trimmed = path.replace(/[/\\]+$/, '')
  const name = trimmed.split(/[/\\]/).pop()
  return { path, name: name && name.length > 0 ? name : path }
}
