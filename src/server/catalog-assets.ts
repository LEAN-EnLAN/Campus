import { posix, resolve, sep } from 'node:path'

/**
 * Where the bundled academic catalog is served from.
 *
 * It lives in `public/`, which Vite normally serves for free — and that is
 * exactly the problem this module exists to solve. Vite builds its list of
 * public files ONCE at startup and keeps it. `scripts/generate-catalog.mjs`
 * begins with `rmSync(OUT_DIR, { recursive: true })` and recreates the tree, so
 * every regeneration drops the catalog out of that list: the files are on disk,
 * the server answers `/academic-catalog/institutions.json` with `index.html`
 * at status 200, and the app dies on `Unexpected token '<'` until someone
 * restarts the dev server.
 *
 * Reading from disk per request costs nothing at this size and cannot go stale.
 */
export const CATALOG_PREFIX = '/academic-catalog'

/**
 * The file a catalog URL names, or null if it names nothing we will serve.
 *
 * This is a second file server in a codebase that deliberately keeps ONE
 * filesystem authority, so it is written to refuse rather than to resolve:
 * anything that is not plainly a file inside the catalog directory is null.
 * Pure, so every escape shape is a test rather than a hope.
 */
export function resolveCatalogAsset(urlPath: string, rootDir: string): string | null {
  const [pathOnly] = urlPath.split('?')
  if (!pathOnly) return null

  // A prefix match is not a path match: `/academic-catalogX` shares the first
  // seventeen characters and is a different place entirely.
  if (!pathOnly.startsWith(`${CATALOG_PREFIX}/`)) return null

  let relative: string
  try {
    relative = decodeURIComponent(pathOnly.slice(CATALOG_PREFIX.length + 1))
  } catch {
    // A malformed escape is not a filename. Refusing beats throwing inside a
    // middleware, where the failure would surface as a dev-server crash.
    return null
  }

  if (relative.length === 0) return null
  // No directory listing exists to serve, so a trailing slash names nothing.
  if (relative.endsWith('/')) return null
  // Backslashes are a path separator on the platform this may also run on, and
  // a decoding difference everywhere else. Neither belongs in a URL path.
  if (relative.includes('\\')) return null
  // A null byte truncates the path inside some filesystem calls: the name the
  // check sees and the name the kernel opens stop being the same string.
  if (relative.includes('\0')) return null
  // Decoding can reveal a traversal that the raw URL hid, so the check happens
  // after decode, on segments, rather than on the original text.
  //
  // The rule is `startsWith('..')`, not `=== '..'`. A double-encoded attempt
  // survives one decode as the single literal segment `..%2F..%2Fetc`, which
  // resolves INSIDE the root and is therefore already safe — but no catalog
  // file is legitimately named that, and refusing the whole shape is cheaper
  // than reasoning about how many decodes a proxy did before we saw it.
  if (relative.split('/').some((segment) => segment.startsWith('..') || segment === ''))
    return null

  const target = resolve(rootDir, relative)

  // The belt to the suspenders above: whatever the segments looked like, the
  // resolved path has to still be under the root.
  const root = resolve(rootDir)
  if (target !== root && !target.startsWith(root + sep)) return null

  return posix.normalize(target)
}
