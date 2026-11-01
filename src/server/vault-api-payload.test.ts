import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { handleVaultRequest, PREFIX, VaultSessions } from './vault-api'

const origin = 'http://localhost:5173'
const token = 'test-capability'
const sessions = new VaultSessions({ allowedRoots: [tmpdir()] })
let root: string
let id: string
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'campus-payload-'))
  id = (await sessions.open(root)).id
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

function request(endpoint: string, body: string, capability = token, requestOrigin = origin) {
  return handleVaultRequest(
    {
      method: 'POST',
      url: `${PREFIX}/${endpoint}`,
      body,
      headers: { origin: requestOrigin, 'x-campus-capability': capability },
    },
    sessions,
    { allowedOrigins: [origin], token },
  )
}

describe('Vault API payload boundary', () => {
  it.each(['null', '[]', '[{}]', '42', 'true', '"text"'])(
    'rejects non-object JSON %s before every endpoint dispatch',
    async (body) => {
      for (const endpoint of ['open', 'exists', 'dirs', `${id}/op`]) {
        const response = await request(endpoint, body)
        expect(response.status).toBe(400)
        expect(JSON.parse(response.body)).toMatchObject({ ok: false, code: 'bad_request' })
        expect(response.headers['access-control-allow-origin']).toBe(origin)
      }
    },
  )

  it('checks origin and capability before parsing hostile bodies', async () => {
    for (const body of ['null', '[]', '{broken']) {
      const unauthorized = await request('open', body, 'wrong')
      expect(unauthorized.status).toBe(401)
      expect(JSON.parse(unauthorized.body).code).toBe('unauthorized')
      const hostile = await request('open', body, 'wrong', 'https://hostile.example')
      expect(hostile.status).toBe(403)
      expect(JSON.parse(hostile.body).code).toBe('origin_not_allowed')
      expect(hostile.headers['access-control-allow-origin']).toBeUndefined()
    }
  })

  it('keeps valid object requests working', async () => {
    const response = await request(`${id}/op`, JSON.stringify({ op: 'listDir', path: '' }))
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ ok: true, value: [] })
  })
})
