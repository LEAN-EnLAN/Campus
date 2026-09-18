/**
 * Which browser origins the Vault API will answer.
 *
 * The default is loopback and nothing else, because the API can read and
 * write the student's files and the architecture's rule is that this is never
 * reachable from another machine. That rule is what `assertLoopbackBind`
 * enforces on the BIND; this list enforces it on the ORIGIN, so a reverse
 * proxy sitting in front of a loopback bind still cannot widen the audience
 * by accident.
 *
 * `CAMPUS_VAULT_ALLOWED_ORIGINS` is the deliberate exception. It exists for a
 * Tailscale tailnet — a device-authenticated WireGuard mesh of the student's
 * own machines, fronted by `tailscale serve` proxying to loopback — and it has
 * to be written down by hand, per origin, no wildcards. The same shape as
 * `CAMPUS_VAULT_API=off`: an escape hatch you can grep for, not a default you
 * can forget.
 */

export const ALLOWED_ORIGINS_ENV = 'CAMPUS_VAULT_ALLOWED_ORIGINS'

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'] as const

/** The loopback origins for the scheme and port actually being served. */
export function loopbackOrigins(scheme: 'http' | 'https', port: number): string[] {
  return LOOPBACK_HOSTS.map((host) => `${scheme}://${host}:${port}`)
}

/**
 * Parse the opt-in list.
 *
 * Strict on purpose: an entry that could never equal a browser's `Origin`
 * header is dropped rather than kept, because a value that is visibly "set"
 * and silently never matches is the worst failure a security knob can have.
 * An Origin is scheme + host + optional port — no path, no query, no trailing
 * slash, and never a wildcard.
 */
export function extraAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return []

  const origins: string[] = []
  for (const entry of raw.split(',')) {
    const candidate = entry.trim().replace(/\/+$/, '')
    if (candidate.length === 0 || candidate.includes('*')) continue

    let url: URL
    try {
      url = new URL(candidate)
    } catch {
      continue
    }

    const isWebScheme = url.protocol === 'https:' || url.protocol === 'http:'
    const isBareOrigin = url.pathname === '/' && url.search === '' && url.hash === ''
    if (!isWebScheme || !isBareOrigin || url.hostname.length === 0) continue

    // `url.origin` normalises for us: lower-case host, default port dropped.
    origins.push(url.origin)
  }
  return origins
}

/** Loopback first, then whatever was opted in. */
export function vaultAllowedOrigins(
  scheme: 'http' | 'https',
  port: number,
  extra: string | undefined,
): string[] {
  return [...loopbackOrigins(scheme, port), ...extraAllowedOrigins(extra)]
}
