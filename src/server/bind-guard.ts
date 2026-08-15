/**
 * The Vault API may only ever listen on loopback.
 *
 * This transport reads and writes the student's real files. The capability
 * token, the Origin allowlist and the closed CORS policy are defence in depth —
 * they are NOT permission to expose the service. A defence-in-depth argument
 * that ends with "so it is fine to listen on 0.0.0.0" has stopped being one.
 *
 * The concrete danger it closes: the Vault API mounts into whatever host Vite
 * was given, and `vite --host` (or the tailnet script, which sets one
 * deliberately) widens that bind to every interface. Nothing about running the
 * frontend on a tailnet implies wanting a filesystem API there, but before this
 * guard the two travelled together.
 *
 * There is no LAN mode in this milestone. When one exists it will need its own
 * authentication, and it will opt in explicitly — never by inheriting a flag
 * somebody passed for an unrelated reason.
 */

export type BindVerdict =
  { safe: true; host: string; reason: string } | { safe: false; host: string; reason: string }

/** Hostnames that are loopback by definition, not by DNS luck. */
const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0:0:0:0:0:0:0:1'])

/** Every address in 127.0.0.0/8 is loopback, not just 127.0.0.1. */
const IPV4_LOOPBACK = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

/**
 * Classify a Vite `server.host` value.
 *
 * `undefined` and `false` are Vite's own defaults and mean loopback, which is
 * why the ordinary `pnpm dev` is safe without anybody opting into anything.
 * `true` is what `--host` sets, and it means every interface.
 */
export function classifyBind(host: string | boolean | undefined): BindVerdict {
  if (host === undefined || host === false) {
    return { safe: true, host: 'localhost', reason: 'Vite default bind is loopback' }
  }

  if (host === true) {
    return {
      safe: false,
      host: '0.0.0.0',
      // This is the `vite --host` case, and the one that motivated the guard.
      reason: '`--host` binds every interface',
    }
  }

  const normalised = host.trim().toLowerCase()

  if (LOOPBACK_NAMES.has(normalised) || IPV4_LOOPBACK.test(normalised)) {
    return { safe: true, host, reason: 'loopback address' }
  }

  // Wildcards are named explicitly so the message can say what is wrong rather
  // than lumping them in with "some other address".
  if (normalised === '0.0.0.0' || normalised === '::' || normalised === '[::]') {
    return { safe: false, host, reason: 'wildcard bind exposes every interface' }
  }

  return { safe: false, host, reason: 'not a loopback address' }
}

export class UnsafeVaultBindError extends Error {
  readonly host: string

  constructor(verdict: BindVerdict) {
    super(
      [
        '',
        'Campus refuses to start.',
        '',
        `  The Vault API can read and write your files, and the dev server would bind to "${verdict.host}"`,
        `  (${verdict.reason}). That would make a filesystem API reachable from your network.`,
        '',
        '  There is no LAN mode in this milestone. The Origin allowlist and the capability token',
        '  are defence in depth, not permission to expose the service.',
        '',
        '  Either drop --host / server.host and use the default loopback bind,',
        '  or run the frontend without the Vault API (CAMPUS_VAULT_API=off) if you only',
        '  need CLOUD mode over the network.',
        '',
      ].join('\n'),
    )
    this.name = 'UnsafeVaultBindError'
    this.host = verdict.host
  }
}

/**
 * Fail startup loudly, or return the verdict.
 *
 * Deliberately throws rather than disabling the API quietly: a silent
 * downgrade teaches everyone that the flag "sometimes works", and the next
 * person debugs it by removing the check.
 */
export function assertLoopbackBind(host: string | boolean | undefined): BindVerdict {
  const verdict = classifyBind(host)
  if (!verdict.safe) throw new UnsafeVaultBindError(verdict)
  return verdict
}
