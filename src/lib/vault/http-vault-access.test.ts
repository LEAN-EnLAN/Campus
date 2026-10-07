import { afterEach, describe, expect, it, vi } from 'vitest'

import { VaultConflictError, VaultError } from './errors'
import { httpVaultAccess, openVaultSession, vaultExists } from './http-vault-access'

/**
 * The client reads codes, not prose, and survives a server that answers with
 * something that is not the Vault API at all (a static host's HTML 404/405).
 */

const TRANSPORT = { vaultId: 'v1', token: 't', baseUrl: 'http://localhost:5173' }

const answer = (status: number, body: unknown, contentType = 'application/json') =>
  vi.fn(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': contentType },
      }),
  )

afterEach(() => vi.unstubAllGlobals())

describe('operation errors', () => {
  it('rethrows the server code as a VaultError', async () => {
    vi.stubGlobal(
      'fetch',
      answer(400, {
        ok: false,
        code: 'name_reserved',
        error: '"CON" is a reserved device name',
      }),
    )
    const error = await httpVaultAccess(TRANSPORT)
      .readNote('CON.md')
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(VaultError)
    expect((error as VaultError).code).toBe('name_reserved')
  })

  it('rethrows a conflict as a VaultConflictError with its code, naming the path once', async () => {
    vi.stubGlobal(
      'fetch',
      answer(400, {
        ok: false,
        conflict: true,
        code: 'already_exists',
        error: 'expected a new file, but one already exists on disk',
      }),
    )
    const error = await httpVaultAccess(TRANSPORT)
      .writeNote('prueba.md', 'x', null)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(VaultConflictError)
    expect((error as VaultConflictError).code).toBe('already_exists')
    expect((error as Error).message.split('prueba.md').length - 1).toBe(1)
  })

  it('treats an HTML answer as unavailable, not as a JSON parse error', async () => {
    vi.stubGlobal('fetch', answer(404, '<!doctype html><title>404</title>', 'text/html'))
    const error = await httpVaultAccess(TRANSPORT)
      .stat('a.md')
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(VaultError)
    expect((error as VaultError).code).toBe('unavailable')
    expect((error as Error).message).not.toMatch(/Unexpected token/)
  })

  it('treats a network failure as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const error = await httpVaultAccess(TRANSPORT)
      .stat('a.md')
      .catch((e: unknown) => e)
    expect((error as VaultError).code).toBe('unavailable')
  })

  it('falls back to a generic code when an old server sends none', async () => {
    vi.stubGlobal('fetch', answer(400, { ok: false, error: 'something odd' }))
    const error = await httpVaultAccess(TRANSPORT)
      .stat('a.md')
      .catch((e: unknown) => e)
    expect((error as VaultError).code).toBe('unknown')
  })
})

describe('opening a folder', () => {
  it('carries the refusal code, never the English text', async () => {
    vi.stubGlobal(
      'fetch',
      answer(404, { ok: false, code: 'folder_not_found', error: 'vault not found' }),
    )
    const error = await openVaultSession('http://x', 't', '/nope').catch((e: unknown) => e)
    expect((error as VaultError).code).toBe('folder_not_found')
  })

  it('reports a host that has no Vault API as unavailable', async () => {
    vi.stubGlobal('fetch', answer(200, '<!doctype html>', 'text/html'))
    const error = await openVaultSession('http://x', 't', '/nope').catch((e: unknown) => e)
    expect((error as VaultError).code).toBe('unavailable')
  })

  it('exists is false on any failure and true only on an explicit yes', async () => {
    vi.stubGlobal('fetch', answer(200, { exists: true }))
    expect(await vaultExists('http://x', 't', '/a')).toBe(true)
    vi.stubGlobal('fetch', answer(200, '<!doctype html>', 'text/html'))
    expect(await vaultExists('http://x', 't', '/a')).toBe(false)
    vi.stubGlobal('fetch', answer(403, { ok: false, code: 'folder_outside_roots', error: 'x' }))
    expect(await vaultExists('http://x', 't', '/a')).toBe(false)
  })
})
