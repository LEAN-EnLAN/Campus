import type { VaultDescriptor } from './types'

/**
 * Device-scoped preferences. NEVER vault-scoped.
 *
 * `docs/vault-format.md` says it plainly: vault paths and window layout are
 * device settings by definition and never sync. Writing the list of recent
 * vaults into `.campus/` would mean a student who syncs their vault to a laptop
 * inherits the desktop's absolute paths — paths that do not exist there, naming
 * folders that may not be theirs.
 *
 * So this lives in the browser's own storage, keyed per device, and the vault
 * stays a portable folder that knows nothing about the machines that opened it.
 */

const KEY = 'campus.device.v1'

/** How many recent vaults are worth remembering. A picker, not an archive. */
const MAX_RECENT = 8

export interface DeviceConfig {
  /** Most recent first. */
  recentVaults: VaultDescriptor[]
  /** What to reopen on next launch. `null` means "ask me". */
  lastRuntime: { mode: 'local'; path: string } | { mode: 'cloud' } | null
}

const EMPTY: DeviceConfig = { recentVaults: [], lastRuntime: null }

export interface DeviceStore {
  get(): string | null
  set(value: string): void
}

/** The browser's localStorage, or an in-memory stand-in when it is unavailable. */
export function browserDeviceStore(): DeviceStore {
  try {
    const probe = '__campus_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return {
      get: () => localStorage.getItem(KEY),
      set: (value) => localStorage.setItem(KEY, value),
    }
  } catch {
    // Private browsing, a blocked origin, a headless run. Losing the recent list
    // is a small annoyance; refusing to start over it is not acceptable.
    let memory: string | null = null
    return { get: () => memory, set: (value) => (memory = value) }
  }
}

export function readDeviceConfig(store: DeviceStore): DeviceConfig {
  const raw = store.get()
  if (!raw) return EMPTY
  try {
    const parsed = JSON.parse(raw) as Partial<DeviceConfig>
    return {
      recentVaults: Array.isArray(parsed.recentVaults) ? parsed.recentVaults : [],
      lastRuntime: parsed.lastRuntime ?? null,
    }
  } catch {
    // Corrupt device preferences must never block startup. Nothing here is the
    // student's work — it is all rebuildable by opening a folder again.
    return EMPTY
  }
}

export function writeDeviceConfig(store: DeviceStore, config: DeviceConfig): void {
  store.set(JSON.stringify(config))
}

/** Record a vault as most-recently-used, without duplicating it. */
export function rememberVault(config: DeviceConfig, vault: VaultDescriptor): DeviceConfig {
  const rest = config.recentVaults.filter((v) => v.path !== vault.path)
  return {
    recentVaults: [vault, ...rest].slice(0, MAX_RECENT),
    lastRuntime: { mode: 'local', path: vault.path },
  }
}

/**
 * Drop a vault from the recent list.
 *
 * Used when a remembered folder has gone. It removes the ENTRY, never the
 * folder, and never anything else the student configured.
 */
export function forgetVault(config: DeviceConfig, path: string): DeviceConfig {
  return {
    recentVaults: config.recentVaults.filter((v) => v.path !== path),
    lastRuntime:
      config.lastRuntime?.mode === 'local' && config.lastRuntime.path === path
        ? null
        : config.lastRuntime,
  }
}

export function rememberCloud(config: DeviceConfig): DeviceConfig {
  return { ...config, lastRuntime: { mode: 'cloud' } }
}
