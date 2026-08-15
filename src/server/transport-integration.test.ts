import { createServer, type Server } from 'node:http'
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadPortableCatalog } from '@/lib/backends/local/catalog'
import { LocalBackend } from '@/lib/backends/local/local-backend'
import { nodeCatalogReader } from '@/lib/backends/local/node-catalog'
import type { PortableCatalog } from '@/lib/backends/local/catalog'
import { httpVaultAccess, openVaultSession } from '@/lib/vault/http-vault-access'

import { handleVaultRequest, mintToken, VaultSessions } from './vault-api'

/**
 * The whole chain, over real HTTP, against a real folder.
 *
 *     LocalBackend → VaultAccess → HttpVaultAccess
 *         → fetch → Vault API → VaultRepository → NodeFileSystem → disk
 *
 * One security authority, on the privileged side. The browser holds a thin
 * client that could not resolve a path if it wanted to.
 *
 * Not a mock in sight. Every previous test proved one link; this proves they
 * connect, which is the claim "Campus can actually use this architecture"
 * depends on and which no unit test can make.
 */

const TOKEN = mintToken()
let server: Server
let baseUrl: string
let root: string
let catalog: PortableCatalog

beforeEach(async () => {
  root = join(mkdtempSync(join(tmpdir(), 'campus-transport-')), 'Campus')
  mkdirSync(root, { recursive: true })
  catalog = await loadPortableCatalog(
    join(process.cwd(), 'resources/academic-catalog'),
    nodeCatalogReader,
  )

  const sessions = new VaultSessions()
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      void handleVaultRequest(
        {
          method: req.method ?? 'GET',
          url: req.url ?? '',
          headers: req.headers as Record<string, string | string[] | undefined>,
          body: Buffer.concat(chunks).toString('utf8'),
        },
        sessions,
        { allowedOrigins: [baseUrl], token: TOKEN },
      ).then((response) => {
        res.statusCode = response.status
        for (const [k, v] of Object.entries(response.headers)) res.setHeader(k, v)
        res.end(response.body)
      })
    })
  })

  await new Promise<void>((resolve) => {
    // Loopback only. This API can read and write the student's files, so it
    // must never be reachable from the network by default.
    server.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  rmSync(join(root, '..'), { recursive: true, force: true })
})

/** Build a LocalBackend exactly the way the composition root does. */
async function backendOverHttp(): Promise<LocalBackend> {
  const session = await openVaultSession(baseUrl, TOKEN, root)
  // No client-side VaultRepository. There is exactly one, and it is on the
  // privileged side of the wire — which is the whole point of the redesign.
  return new LocalBackend(
    httpVaultAccess({ vaultId: session.id, token: TOKEN, baseUrl }),
    catalog,
  )
}

describe('LocalBackend over the real transport', () => {
  it('binds to loopback, never to every interface', () => {
    expect((server.address() as AddressInfo).address).toBe('127.0.0.1')
  })

  it('a deadline written through HTTP lands in the real folder', async () => {
    const backend = await backendOverHttp()
    const created = await backend.items.create({
      title: 'TP 4',
      kind: 'assignment',
      curriculumSubjectId: 'analisis-matematico-ii-9',
      dueAt: '2026-08-20T21:00:00.000Z',
    })

    // Read from DISK, not from the backend: the claim is that the folder is
    // the truth, so the folder is what gets inspected.
    const onDisk = JSON.parse(
      readFileSync(join(root, '.campus/academic/items.json'), 'utf8'),
    ) as {
      schemaVersion: number
      items: { id: string; title: string }[]
    }
    expect(onDisk.schemaVersion).toBe(1)
    expect(onDisk.items[0]!.id).toBe(created.id)
    expect(onDisk.items[0]!.title).toBe('TP 4')
  })

  it('a brand new backend over a brand new session reads it back', async () => {
    const first = await backendOverHttp()
    await first.items.create({
      title: 'TP 4',
      kind: 'assignment',
      curriculumSubjectId: null,
      dueAt: null,
    })

    // A restart: new session, new transport, new backend, same folder.
    const second = await backendOverHttp()
    const items = await second.items.list()
    expect(items.map((i) => i.title)).toEqual(['TP 4'])
  })

  it('subject state survives the round trip', async () => {
    const first = await backendOverHttp()
    await first.academic.setSubjectStatus({
      curriculumSubjectId: 'analisis-matematico-i-1',
      status: 'in_progress',
    })

    const second = await backendOverHttp()
    const [state] = await second.academic.subjectStates()
    expect(state!.status).toBe('in_progress')
  })

  it('the transport does not change the meaning of prerequisitesKnown', async () => {
    const backend = await backendOverHttp()
    const unr = await backend.catalog.curriculumBundle('unr/unr-fceia/lcc/TO 2024')
    expect(unr.prerequisitesKnown).toBe(false)
    expect(unr.prerequisites).toEqual([])
  })

  it('a hostile path still cannot escape, even through the whole stack', async () => {
    const session = await openVaultSession(baseUrl, TOKEN, root)
    const access = httpVaultAccess({ vaultId: session.id, token: TOKEN, baseUrl })
    // Bypassing LocalBackend entirely, the way a compromised browser would:
    // straight at the transport, which has no resolver of its own to fool.
    await expect(access.readNote('../outside/secret.txt')).rejects.toThrow(/traversal|outside/i)
    await expect(access.readNote('/etc/passwd')).rejects.toThrow(/absolute/i)
  })
})
