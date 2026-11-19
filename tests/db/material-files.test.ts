import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * A/B isolation evidence for material files (Storage bucket `materials` and the
 * file columns on public.resources).
 *
 * Two real users, real JWTs, the anon key — service-role only for setup/cleanup.
 * Requires the local stack: `pnpm db:start && pnpm db:reset`.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const BUCKET = 'materials'

interface TestUser {
  id: string
  client: SupabaseClient
}

let userA: TestUser
let userB: TestUser
let admin: SupabaseClient
const pathA = () => `${userA.id}/obj-a/apunte.pdf`

function pdf(bytes = 32): Blob {
  return new Blob([new Uint8Array(bytes).fill(37)], { type: 'application/pdf' })
}

async function createUser(label: string): Promise<TestUser> {
  const email = `files-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@campus.test`
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signUp({
    email,
    password: 'campus-test-password-123',
  })
  if (error) throw new Error(`signUp(${label}) failed: ${error.message}`)
  if (!data.user) throw new Error(`signUp(${label}) returned no user`)
  return { id: data.user.id, client }
}

beforeAll(async () => {
  if (!ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY is not set. Run these through `pnpm test:db`.')
  }
  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  userA = await createUser('a')
  userB = await createUser('b')

  const { error } = await userA.client.storage
    .from(BUCKET)
    .upload(pathA(), pdf(), { contentType: 'application/pdf' })
  if (error) throw new Error(`A could not upload into its own folder: ${error.message}`)
}, 60_000)

afterAll(async () => {
  if (!admin) return
  for (const user of [userA, userB]) {
    if (!user?.id) continue
    const { data } = await admin.storage.from(BUCKET).list(`${user.id}/obj-a`)
    const { data: dataB } = await admin.storage.from(BUCKET).list(`${user.id}/obj-b`)
    const paths = [
      ...(data ?? []).map((o) => `${user.id}/obj-a/${o.name}`),
      ...(dataB ?? []).map((o) => `${user.id}/obj-b/${o.name}`),
    ]
    if (paths.length > 0) await admin.storage.from(BUCKET).remove(paths)
    await admin.auth.admin.deleteUser(user.id)
  }
})

describe('materials bucket', () => {
  it('is private', async () => {
    const { data, error } = await admin.storage.getBucket(BUCKET)
    expect(error).toBeNull()
    expect(data?.public).toBe(false)
    expect(data?.file_size_limit).toBe(20 * 1024 * 1024)
  })

  it('lets the owner read and sign their own object', async () => {
    const { data, error } = await userA.client.storage.from(BUCKET).download(pathA())
    expect(error).toBeNull()
    expect(data?.size).toBe(32)
    const signed = await userA.client.storage.from(BUCKET).createSignedUrl(pathA(), 3600)
    expect(signed.error).toBeNull()
    expect(signed.data?.signedUrl).toContain('token=')
  })

  it("B cannot list, download or sign A's object", async () => {
    const listed = await userB.client.storage.from(BUCKET).list(`${userA.id}/obj-a`)
    expect(listed.data ?? []).toHaveLength(0)

    const downloaded = await userB.client.storage.from(BUCKET).download(pathA())
    expect(downloaded.data).toBeNull()
    expect(downloaded.error).not.toBeNull()

    const signed = await userB.client.storage.from(BUCKET).createSignedUrl(pathA(), 60)
    expect(signed.data).toBeNull()
  })

  it("B cannot delete or overwrite A's object", async () => {
    await userB.client.storage.from(BUCKET).remove([pathA()])
    await userB.client.storage
      .from(BUCKET)
      .upload(pathA(), pdf(8), { contentType: 'application/pdf', upsert: true })

    const { data, error } = await admin.storage.from(BUCKET).download(pathA())
    expect(error).toBeNull()
    expect(data?.size).toBe(32) // still A's, untouched
  })

  it("B cannot upload into A's folder", async () => {
    const { error } = await userB.client.storage
      .from(BUCKET)
      .upload(`${userA.id}/obj-b/intruso.pdf`, pdf(), { contentType: 'application/pdf' })
    expect(error).not.toBeNull()
  })

  it('refuses a type outside the allowlist', async () => {
    const { error } = await userA.client.storage
      .from(BUCKET)
      .upload(`${userA.id}/obj-b/script.html`, new Blob(['<p>x</p>'], { type: 'text/html' }), {
        contentType: 'text/html',
      })
    expect(error).not.toBeNull()
  })
})

describe('resources file columns', () => {
  it('accepts a file row inside its own folder and B cannot see it', async () => {
    const { data, error } = await userA.client
      .from('resources')
      .insert({
        user_id: userA.id,
        kind: 'file',
        title: 'Apunte',
        storage_path: pathA(),
        mime_type: 'application/pdf',
        size_bytes: 32,
      })
      .select('id')
      .single()
    expect(error).toBeNull()

    const seen = await userB.client.from('resources').select('id').eq('id', data!.id)
    expect(seen.data).toHaveLength(0)
  })

  it("refuses a file row pointing into another user's folder", async () => {
    const { error } = await userB.client.from('resources').insert({
      user_id: userB.id,
      kind: 'file',
      title: 'Robado',
      storage_path: pathA(),
      mime_type: 'application/pdf',
      size_bytes: 32,
    })
    expect(error?.code).toBe('23514') // check_violation
  })

  it('refuses file metadata on a link', async () => {
    const { error } = await userA.client.from('resources').insert({
      user_id: userA.id,
      kind: 'link',
      title: 'Link',
      url: 'https://example.org',
      mime_type: 'application/pdf',
    })
    expect(error?.code).toBe('23514')
  })
})
