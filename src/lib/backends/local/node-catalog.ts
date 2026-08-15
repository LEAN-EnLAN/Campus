import { readdir, readFile } from 'node:fs/promises'

import type { CatalogReader } from './catalog'

/**
 * The Node reader for the portable catalog.
 *
 * Isolated in its own module so `node:fs` never enters the module graph the
 * browser bundle pulls in. Tests and the dev-server route import this; the
 * browser gets the bundled catalog through a different reader.
 */
export const nodeCatalogReader: CatalogReader = {
  readFile: (path) => readFile(path, 'utf8'),
  readDir: (path) => readdir(path),
}
