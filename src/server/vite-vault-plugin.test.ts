import type { AddressInfo } from 'node:net'
import { createServer, request, type Server } from 'node:http'

import type { Connect, ViteDevServer } from 'vite'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

import { VaultSessions } from './vault-api'
import { campusVaultPlugin } from './vite-vault-plugin'

let server: Server
let baseUrl: string
let token: string
beforeAll(async () => {
  const plugin = campusVaultPlugin()
  let middleware!: Connect.NextHandleFunction
  // Supply only Vite's registration surface; requests cross a real Node server
  // and the actual plugin middleware, handler, and session implementation.
  const register = plugin.configureServer as (server: ViteDevServer) => void
  register({
    middlewares: {
      use: (handler: Connect.NextHandleFunction) => {
        middleware = handler
      },
    },
  } as unknown as ViteDevServer)
  const inject = plugin.transformIndexHtml as unknown as () => { children: string }[]
  token = JSON.parse(inject()[0]!.children.split('=')[1]!) as string
  server = createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 404
      res.end()
    }),
  )
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  vi.restoreAllMocks()
  server?.closeAllConnections()
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
})

function post(body: string) {
  return new Promise<{ status: number | undefined; cache: string | undefined; body: string }>(
    (resolve, reject) => {
      const req = request(
        `${baseUrl}/__campus/vault/exists`,
        {
          method: 'POST',
          headers: { 'x-campus-capability': token },
        },
        (res) => {
          let text = ''
          res.setEncoding('utf8')
          res.on('data', (chunk: string) => {
            text += chunk
          })
          res.on('end', () =>
            resolve({
              status: res.statusCode,
              cache: res.headers['cache-control'],
              body: text,
            }),
          )
          res.on('error', reject)
        },
      )
      req.setTimeout(1500, () => req.destroy(new Error('vault response timed out')))
      req.on('error', reject)
      req.end(body)
    },
  )
}

it('contains an unexpected handler rejection and serves the next request', async () => {
  const spy = vi
    .spyOn(VaultSessions.prototype, 'exists')
    .mockRejectedValueOnce(new Error('private C:/students/secret-vault'))
  try {
    const response = await post(JSON.stringify({ path: 'irrelevant' }))
    expect(response.status).toBe(500)
    expect(response.cache).toBe('no-store')
    expect(JSON.parse(response.body)).toEqual({
      ok: false,
      code: 'io_error',
      error: 'vault request failed',
    })
    const next = await post('{}')
    expect(next.status).toBe(400)
  } finally {
    spy.mockRestore()
  }
})
