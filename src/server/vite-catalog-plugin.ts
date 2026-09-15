import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'

import type { Plugin } from 'vite'

import { resolveCatalogAsset } from './catalog-assets'

/**
 * Serves the bundled academic catalog during development, from disk, per
 * request.
 *
 * Vite already serves `public/`, so this looks redundant until the catalog is
 * regenerated. `scripts/generate-catalog.mjs` starts by deleting the whole
 * output directory and rebuilding it; Vite's list of public files is built once
 * at startup and does not recover from that. The files exist, and the server
 * answers `/academic-catalog/institutions.json` with `index.html` at status
 * 200 — a success the JSON parser then fails on, reporting
 * `Unexpected token '<'`, which names the symptom and hides the cause. The only
 * cure was restarting the dev server, and the error message told the student to
 * regenerate the catalog, which is the one action that re-breaks it.
 *
 * Answering before that middleware, from the filesystem, ends the class of
 * failure rather than the instance. The catalog is small reference data; the
 * read costs nothing and can never be stale.
 */
export function campusCatalogPlugin(): Plugin {
  return {
    name: 'campus-academic-catalog',
    // Development only. A production build copies `public/` into the output and
    // a real static host has no such cache to go stale.
    apply: 'serve',

    configureServer(server) {
      const root = join(server.config.root, 'public', 'academic-catalog')

      // `pre` matters: this has to run BEFORE Vite's public-file middleware and
      // its SPA fallback, which is the thing that answers with index.html.
      server.middlewares.use((req, res, next) => {
        const target = req.url ? resolveCatalogAsset(req.url, root) : null
        if (!target) return next()

        void stat(target)
          .then((info) => {
            if (!info.isFile()) return next()
            res.setHeader('content-type', 'application/json; charset=utf-8')
            // Reference data that is regenerated in place: a cached copy would
            // reintroduce exactly the staleness this plugin exists to remove.
            res.setHeader('cache-control', 'no-cache')
            createReadStream(target).pipe(res)
          })
          .catch(() => {
            // Genuinely absent. Falling through would hand it to the SPA
            // fallback and produce the 200-with-HTML this plugin exists to
            // prevent, so the answer is an honest 404 in the shape the client
            // is already parsing.
            res.statusCode = 404
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'catalog asset not found' }))
          })
      })
    },
  }
}
