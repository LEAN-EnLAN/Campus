import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * A/B isolation evidence for Row Level Security.
 *
 * Two real users, two real JWTs, the anon key — never service-role. "RLS is
 * enabled" is a claim; this file is the evidence.
 *
 * Requires the local stack: `pnpm db:start && pnpm db:reset`.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

interface TestUser {
  id: string
  email: string
  client: SupabaseClient
}

let userA: TestUser
let userB: TestUser
let admin: SupabaseClient
let curriculumSubjectId: string
let curriculumId: string

async function createUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@campus.test`
  const password = 'campus-test-password-123'

  const client = anonClient()
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw new Error(`signUp(${label}) failed: ${error.message}`)
  if (!data.user) throw new Error(`signUp(${label}) returned no user`)

  return { id: data.user.id, email, client }
}

beforeAll(async () => {
  if (!ANON_KEY) {
    throw new Error(
      'SUPABASE_ANON_KEY is not set. Run these through `pnpm test:db` (scripts/with-supabase-env.mjs).',
    )
  }

  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  userA = await createUser('a')
  userB = await createUser('b')

  // Grab any seeded curriculum subject to hang user rows off.
  const { data, error } = await admin
    .from('curriculum_subjects')
    .select('id, curriculum_id')
    .limit(1)
    .single()
  if (error) throw new Error(`no seeded curriculum_subjects: ${error.message}`)
  curriculumSubjectId = data.id
  curriculumId = data.curriculum_id
}, 60_000)

afterAll(async () => {
  if (!admin) return
  for (const user of [userA, userB]) {
    if (user?.id) await admin.auth.admin.deleteUser(user.id)
  }
})

describe('profiles', () => {
  it('creates a profile automatically on signup', async () => {
    const { data, error } = await userA.client.from('profiles').select('id').single()
    expect(error).toBeNull()
    expect(data?.id).toBe(userA.id)
  })

  it('does not expose another user profile', async () => {
    const { data } = await userB.client.from('profiles').select('id').eq('id', userA.id)
    expect(data).toEqual([])
  })
})

describe('academic_items — A/B isolation', () => {
  let itemId: string

  it('lets user A create their own item', async () => {
    const { data, error } = await userA.client
      .from('academic_items')
      .insert({
        user_id: userA.id,
        curriculum_subject_id: curriculumSubjectId,
        kind: 'assignment',
        title: 'TP 4 de A',
        due_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    itemId = data!.id
  })

  it('does not let user B read user A rows', async () => {
    const { data, error } = await userB.client.from('academic_items').select('id')
    // RLS filters rather than errors — B sees an empty set, not a 403.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('does not let user B update a user A row', async () => {
    const { data } = await userB.client
      .from('academic_items')
      .update({ title: 'secuestrado' })
      .eq('id', itemId)
      .select('id')

    expect(data).toEqual([])

    const { data: still } = await userA.client
      .from('academic_items')
      .select('title')
      .eq('id', itemId)
      .single()
    expect(still?.title).toBe('TP 4 de A')
  })

  it('does not let user B delete a user A row', async () => {
    const { data } = await userB.client
      .from('academic_items')
      .delete()
      .eq('id', itemId)
      .select('id')

    expect(data).toEqual([])

    const { count } = await userA.client
      .from('academic_items')
      .select('id', { count: 'exact', head: true })
      .eq('id', itemId)
    expect(count).toBe(1)
  })

  it("rejects an insert carrying another user's id", async () => {
    const { error } = await userB.client.from('academic_items').insert({
      user_id: userA.id,
      kind: 'task',
      title: 'inyectado',
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501') // insufficient_privilege — RLS with check
  })

  it('rejects reassigning an owned row to another user', async () => {
    const { data: mine } = await userB.client
      .from('academic_items')
      .insert({ user_id: userB.id, kind: 'task', title: 'mío' })
      .select('id')
      .single()

    const { error } = await userB.client
      .from('academic_items')
      .update({ user_id: userA.id })
      .eq('id', mine!.id)

    // This is the `with check` on UPDATE doing its job.
    expect(error).not.toBeNull()
  })
})

describe('user_subject_states — A/B isolation', () => {
  it('isolates subject progress between users', async () => {
    const { error: insertError } = await userA.client.from('user_subject_states').insert({
      user_id: userA.id,
      curriculum_subject_id: curriculumSubjectId,
      status: 'passed',
    })
    expect(insertError).toBeNull()

    const { data } = await userB.client.from('user_subject_states').select('id')
    expect(data).toEqual([])
  })
})

describe('user_academic_contexts — A/B isolation', () => {
  it('isolates academic context between users', async () => {
    const { error } = await userA.client.from('user_academic_contexts').insert({
      user_id: userA.id,
      curriculum_id: curriculumId,
      is_active: true,
    })
    expect(error).toBeNull()

    const { data } = await userB.client.from('user_academic_contexts').select('id')
    expect(data).toEqual([])
  })
})

describe('resources — A/B isolation', () => {
  it('isolates resources between users', async () => {
    const { error } = await userA.client.from('resources').insert({
      user_id: userA.id,
      curriculum_subject_id: curriculumSubjectId,
      kind: 'link',
      title: 'Apunte de A',
      url: 'https://example.org/a',
    })
    expect(error).toBeNull()

    const { data } = await userB.client.from('resources').select('id')
    expect(data).toEqual([])
  })
})

describe('academic reference tier', () => {
  it('is readable by any authenticated user', async () => {
    const { data, error } = await userB.client.from('institutions').select('slug')
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('is not writable from the client', async () => {
    const { error } = await userA.client
      .from('institutions')
      .insert({ slug: 'fake', name: 'Fake', short_name: 'FK' })
    expect(error).not.toBeNull()
  })

  it('refuses to delete curated curriculum data from the client', async () => {
    const { data } = await userA.client
      .from('curriculum_subjects')
      .delete()
      .eq('id', curriculumSubjectId)
      .select('id')
    expect(data ?? []).toEqual([])
  })
})

describe('anon role', () => {
  it('cannot read user-owned tables at all', async () => {
    const anon = anonClient()
    const { data, error } = await anon.from('academic_items').select('id')
    expect(error !== null || (data ?? []).length === 0).toBe(true)
  })
})
