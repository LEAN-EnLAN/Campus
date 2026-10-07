import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'

import type { Plugin } from 'vite'

import { assertLoopbackBind } from './bind-guard'
import { handleVaultRequest, mintToken, PREFIX, VaultSessions } from './vault-api'
import { ALLOWED_ORIGINS_ENV, vaultAllowedOrigins } from './vault-origins'
import { ALLOWED_ROOTS_ENV, parseAllowedRoots } from './vault-roots'

/**
 * Mounts the Vault API during development. Nothing more.
 *
 * The handler itself lives in `vault-api.ts` and knows nothing about Vite, so
 * `campus serve` (Milestone D) mounts the same code behind a plain Node server
 * without a rewrite. A transport that only exists as a Vite plugin becomes the
 * production architecture by accident, and then has to be rebuilt under
 * deadline — which is exactly when a security boundary gets simplified.
 *
 * The capability is minted per process and injected into the served HTML. A
 * page from another origin cannot read it (same-origin policy) and cannot guess
 * it (32 random bytes), which is what makes loopback binding meaningful rather
 * than decorative: this API can read and write the student's files.
 */
export function campusVaultPlugin(): Plugin {
  // Which folders may be opened as a Vault: the user's home, unless
  // CAMPUS_VAULT_ALLOWED_ROOTS says otherwise (an explicit list, never widened).
  const roots = parseAllowedRoots(process.env[ALLOWED_ROOTS_ENV], homedir())
  const sessions = new VaultSessions({ allowedRoots: roots.roots })
  const token = mintToken()
  let allowedOrigins: string[] = []
  // The escape hatch is for running the FRONTEND over a network without the
  // filesystem API — CLOUD mode only. It disables the transport; it never
  // relaxes the bind rule.
  const enabled = process.env.CAMPUS_VAULT_API !== 'off'

  return {
    name: 'campus-vault-api',
    // Development only, and stated rather than implied: this must never be
    // part of a production bundle.
    apply: 'serve',

    configResolved(config) {
      if (!enabled) return

      for (const entry of roots.rejected) {
        // A security setting that is set but ignored must not be silent.
        config.logger.warn(
          `[campus] ${ALLOWED_ROOTS_ENV}: ignored "${entry}" (needs an absolute path other than the filesystem root)`,
        )
      }
      if (roots.roots.length === 0) {
        config.logger.warn(
          `[campus] ${ALLOWED_ROOTS_ENV} has no usable entry: no folder can be opened`,
        )
      }

      const { https, port = 5173, host } = config.server

      // Startup fails here, loudly, rather than mounting a filesystem API on
      // whatever interface someone happened to ask the frontend to use. The
      // capability token and Origin allowlist below are defence in depth, and
      // defence in depth is not permission to expose the service.
      assertLoopbackBind(host)

      const scheme = https ? 'https' : 'http'
      // Loopback origins, because only a loopback bind reached this line —
      // plus any origin written down by hand in CAMPUS_VAULT_ALLOWED_ORIGINS.
      // That is how a tailnet device gets in: a reverse proxy in front of this
      // loopback bind, and an explicit line saying which origin it presents.
      allowedOrigins = vaultAllowedOrigins(scheme, port, process.env[ALLOWED_ORIGINS_ENV])
    },

    configureServer(server) {
      if (!enabled) return
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith(PREFIX)) return next()

        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          void handleVaultRequest(
            {
              method: req.method ?? 'GET',
              url: req.url ?? '',
              headers: req.headers as Record<string, string | string[] | undefined>,
              body: Buffer.concat(chunks).toString('utf8'),
            },
            sessions,
            { allowedOrigins, token },
          ).then((response) => {
            res.statusCode = response.status
            for (const [key, value] of Object.entries(response.headers))
              res.setHeader(key, value)
            res.end(response.body)
          })
        })
      })
    },

    transformIndexHtml() {
      if (!enabled) return []
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: `window.__CAMPUS_VAULT_TOKEN__=${JSON.stringify(token)}`,
        },
      ]
    },
  }
}
