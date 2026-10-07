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
