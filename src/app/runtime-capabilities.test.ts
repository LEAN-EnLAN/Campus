import { afterEach, describe, expect, it, vi } from 'vitest'

import { VaultError } from '@/lib/vault/errors'

import { resolveRuntimeCapabilities } from './runtime-capabilities'

describe('resolveRuntimeCapabilities — the build-time Vault capability', () => {
  it('offers the Vault on a normal build', () => {
    expect(resolveRuntimeCapabilities({}).vaultAvailable).toBe(true)
  })

  it('withdraws it on a hosted build (VITE_CAMPUS_VAULT=off)', () => {
    expect(resolveRuntimeCapabilities({ VITE_CAMPUS_VAULT: 'off' }).vaultAvailable).toBe(false)
  })
})

describe('vaultExists — a remembered vault that cannot be opened says why', () => {
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })

  /** `exists` answers false for gone and for outside-the-roots alike; `open` tells them apart. */
  const server = (openAnswer: Response) =>
    vi.fn(async (url: string) =>
      url.endsWith('/exists') ? reply(200, { exists: false }) : openAnswer,
    )

  afterEach(() => vi.unstubAllGlobals())

  it('rejects with the code when the folder is outside the allowed roots', async () => {
    vi.stubGlobal(
      'fetch',
      server(reply(403, { ok: false, code: 'folder_outside_roots', error: 'x' })),
    )

    await expect(
      resolveRuntimeCapabilities({}).vaultExists('/tmp/vault'),
    ).rejects.toMatchObject({
      code: 'folder_outside_roots',
    })
    await expect(
      resolveRuntimeCapabilities({}).vaultExists('/tmp/vault'),
    ).rejects.toBeInstanceOf(VaultError)
  })

  it('stays a plain "not there" when the folder is simply gone', async () => {
    vi.stubGlobal(
      'fetch',
      server(reply(404, { ok: false, code: 'folder_not_found', error: 'x' })),
    )

    expect(await resolveRuntimeCapabilities({}).vaultExists('/home/x/gone')).toBe(false)
  })
})

describe('folder browsing and creation reach the Vault API', () => {
  const reply = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  afterEach(() => vi.unstubAllGlobals())

  it('listFolders asks the dirs endpoint', async () => {
    const fetchMock = vi.fn(async () => reply({ path: '/home/ana', parent: null, dirs: ['A'] }))
    vi.stubGlobal('fetch', fetchMock)

    const listing = await resolveRuntimeCapabilities({}).listFolders!('/home/ana')

    expect(listing.dirs).toEqual(['A'])
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toMatch(
      /\/__campus\/vault\/dirs$/,
    )
  })

  it('openLocal can ask for the missing folder to be created', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/open') ? reply({ id: 'v', name: 'Campus' }) : reply({}),
    )
    vi.stubGlobal('fetch', fetchMock)
    // The catalog is fetched too; its failure is not what is under test.
    await resolveRuntimeCapabilities({})
      .openLocal({ path: '/home/ana/Campus', name: 'Campus' }, { create: true })
      .catch(() => undefined)

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({ path: '/home/ana/Campus', create: true })
  })
})
