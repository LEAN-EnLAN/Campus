import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll } from 'vitest'

import { LocalBackend } from '@/lib/backends/local/local-backend'
import type { PortableCatalog } from '@/lib/backends/local/catalog'
import { createSupabaseBackend } from '@/lib/backends/supabase-backend'
import { nodeFileSystem } from '@/lib/vault/node-fs'
import type { VaultAccess } from '@/lib/vault/vault-access'
import { VaultRepository } from '@/lib/vault/vault-repository'

import { createFakeSupabase } from '../support/fake-supabase'
import { describeSharedBackendBehaviour } from '../support/shared-backend-behaviour'

/**
 * DEV-15 / DEV-16 — one contract, two adapters, run in `pnpm test`.
 *
 * `tests/db/conformance.test.ts` proves the same thing against a real Supabase
 * but needs Docker; this keeps the behaviours that drifted (grade clearing,
 * completedAt, trimming, saveContext atomicity) from drifting again without it.
 */

const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

const emptyCatalog: PortableCatalog = { institutions: [], curricula: new Map() }

describeSharedBackendBehaviour({
  name: 'LocalBackend',
  subjectId: 'analisis-matematico-i-1',
  async open() {
    const base = mkdtempSync(join(tmpdir(), 'campus-shared-'))
    roots.push(base)
    const root = join(base, 'Campus')
    mkdirSync(root, { recursive: true })

    let failWrites = 0
    const repository = new VaultRepository(nodeFileSystem, root)
    // A vault whose next context write fails — the local analogue of a failed insert.
    const vault: VaultAccess = new Proxy(repository, {
      get(target, prop, receiver) {
        if (prop === 'writeNote') {
          return async (path: string, ...rest: [string, number | null]) => {
            if (failWrites > 0 && path.endsWith('context.json')) {
              failWrites -= 1
              throw new Error('forced write failure')
            }
            return target.writeNote(path, ...rest)
          }
        }
        return Reflect.get(target, prop, receiver) as unknown
      },
    })

    const make = () => new LocalBackend(vault, emptyCatalog)
    return {
      backend: make(),
      reopen: async () => make(),
      failNextContextWrite: () => void (failWrites = 1),
    }
  },
})

describeSharedBackendBehaviour({
  name: 'SupabaseBackend (in-memory PostgREST)',
  subjectId: 'cs-1',
  async open() {
    const fake = createFakeSupabase()
    const make = () => createSupabaseBackend(fake.client)
    return {
      backend: make(),
      reopen: async () => make(),
      failNextContextWrite: () => fake.failNextInsert('user_academic_contexts'),
    }
  },
})
