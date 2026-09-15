import { describe, expect, it } from 'vitest'

import { fetchCatalogFile } from './catalog-fetch'

const respond =
  (body: string, init: { status?: number; type?: string } = {}) =>
  async () =>
    new Response(body, {
      status: init.status ?? 200,
      headers: { 'content-type': init.type ?? 'application/json' },
    })

describe('fetchCatalogFile', () => {
  it('returns the body when the file is really there', async () => {
    await expect(
      fetchCatalogFile('/academic-catalog/institutions.json', respond('{"ok":true}')),
    ).resolves.toBe('{"ok":true}')
  })

  it('names a missing file when the dev server answers with the app itself', async () => {
    // The failure that cost an afternoon. A dev server has no 404 for unknown
    // paths: it serves index.html with status 200, so `response.ok` is true,
    // the guard passes, and the JSON parser is left to report
    // `Unexpected token '<'` — the symptom, never the cause.
    const send = respond('<!doctype html><html></html>', { type: 'text/html; charset=utf-8' })

    await expect(fetchCatalogFile('/academic-catalog/curricula.json', send)).rejects.toThrow(
      /curricula\.json/,
    )
    await expect(fetchCatalogFile('/academic-catalog/curricula.json', send)).rejects.toThrow(
      /no está publicad/i,
    )
  })

  it('still reports an honest error status', async () => {
    await expect(
      fetchCatalogFile('/academic-catalog/x.json', respond('nope', { status: 500 })),
    ).rejects.toThrow(/500/)
  })

  it('accepts a server that serves JSON without saying so', async () => {
    // Only HTML is treated as the fallback. A bare or odd content-type is not
    // evidence of anything, and refusing it would break real static hosts.
    await expect(
      fetchCatalogFile('/academic-catalog/a.json', respond('[]', { type: '' })),
    ).resolves.toBe('[]')
  })
})
