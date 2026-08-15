import type { IncomingMessage, ServerResponse } from 'node:http'

import type { Plugin } from 'vite'

import { handleVaultRequest, mintToken, PREFIX, VaultSessions } from './vault-api'

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
  const sessions = new VaultSessions()
  const token = mintToken()
  let allowedOrigins: string[] = []

  return {
    name: 'campus-vault-api',
    // Development only, and stated rather than implied: this must never be
    // part of a production bundle.
    apply: 'serve',

    configResolved(config) {
      const { https, port = 5173, host } = config.server
      const scheme = https ? 'https' : 'http'
      // Loopback by default. `host` is only honoured when the developer set it
      // deliberately (the tailnet script does), and it is still an allowlist —
      // never a wildcard.
      const hosts = ['localhost', '127.0.0.1', ...(typeof host === 'string' ? [host] : [])]
      allowedOrigins = hosts.map((h) => `${scheme}://${h}:${port}`)
    },

    configureServer(server) {
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
