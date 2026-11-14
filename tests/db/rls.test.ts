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

    // A still sees her own row — otherwise a USING (false) policy would pass this test.
    const { data: mine } = await userA.client.from('user_subject_states').select('id, status')
    expect(mine).toHaveLength(1)
    expect(mine?.[0]?.status).toBe('passed')

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

    const { data: mine } = await userA.client
      .from('user_academic_contexts')
      .select('id, curriculum_id')
    expect(mine).toHaveLength(1)
    expect(mine?.[0]?.curriculum_id).toBe(curriculumId)

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

    const { data: mine } = await userA.client.from('resources').select('id, title')
    expect(mine).toHaveLength(1)
    expect(mine?.[0]?.title).toBe('Apunte de A')

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

// --------------------------------------------------------------------------
// Account, privacy and metrics (20261114000100_account_privacy_metrics.sql)
// --------------------------------------------------------------------------

describe('product_events — consent-gated, write-only', () => {
  const ref = 'abcd1234EFGH'

  it('rejects an event while the profile has no consent', async () => {
    const { error } = await userA.client
      .from('product_events')
      .insert({ name: 'share_copied', ref })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('accepts an event once the student consents', async () => {
    const { error: consentError } = await userA.client
      .from('profiles')
      .update({ metrics_consent: true, metrics_consent_at: new Date().toISOString() })
      .eq('id', userA.id)
    expect(consentError).toBeNull()

    const { error } = await userA.client
      .from('product_events')
      .insert({ name: 'share_copied', ref })
    expect(error).toBeNull()

    // user_id defaults to the caller: the row is A's, read back with service role.
    const { data } = await admin
      .from('product_events')
      .select('user_id, name, ref')
      .eq('ref', ref)
    expect(data).toEqual([{ user_id: userA.id, name: 'share_copied', ref }])
  })

  it("rejects an event carrying another user's id", async () => {
    const { error } = await userA.client
      .from('product_events')
      .insert({ user_id: userB.id, name: 'share_copied', ref })
    expect(error).not.toBeNull()
  })

  it('rejects an event name outside the allowed set', async () => {
    const { error } = await userA.client
      .from('product_events')
      .insert({ name: 'note_opened', ref })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514') // check_violation
  })

  it('rejects a malformed ref', async () => {
    const { error } = await userA.client
      .from('product_events')
      .insert({ name: 'share_saved', ref: 'mail@x' })
    expect(error).not.toBeNull()
  })

  it('stops accepting events as soon as consent is withdrawn', async () => {
    const off = await userA.client
      .from('profiles')
      .update({ metrics_consent: false })
      .eq('id', userA.id)
    expect(off.error).toBeNull()
    const { error } = await userA.client
      .from('product_events')
      .insert({ name: 'share_saved', ref })
    expect(error).not.toBeNull()
  })

  it('cannot be read back by an authenticated user, not even their own rows', async () => {
    const { data, error } = await userA.client.from('product_events').select('id')
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
    expect(data).toBeNull()
  })
})

describe('feedback — write-only', () => {
  it('accepts feedback from its author', async () => {
    const { error } = await userB.client.from('feedback').insert({
      body: 'Me gustaría ver los parciales en rojo',
      route: '/today',
      app_version: '0.1.0',
    })
    expect(error).toBeNull()
  })

  it('rejects an empty body and a body over 2000 characters', async () => {
    const blank = await userB.client.from('feedback').insert({ body: '   ' })
    expect(blank.error).not.toBeNull()
    const long = await userB.client.from('feedback').insert({ body: 'a'.repeat(2001) })
    expect(long.error).not.toBeNull()
  })

  it("rejects feedback carrying another user's id", async () => {
    const { error } = await userB.client
      .from('feedback')
      .insert({ user_id: userA.id, body: 'suplantado' })
    expect(error).not.toBeNull()
  })

  it('cannot be read by an authenticated user', async () => {
    const { data, error } = await userB.client.from('feedback').select('id')
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
    expect(data).toBeNull()
  })

  it('is not reachable for anon at all', async () => {
    const { error } = await anonClient().from('feedback').insert({ body: 'anónimo' })
    expect(error).not.toBeNull()
  })
})

describe('aggregate metrics — service role only', () => {
  it('refuses weekly_activity() and funnel_counts() to authenticated', async () => {
    const weekly = await userA.client.rpc('weekly_activity')
    expect(weekly.error).not.toBeNull()
    expect(weekly.error?.code).toBe('42501')
    const funnel = await userA.client.rpc('funnel_counts', { since: '2026-01-01T00:00:00Z' })
    expect(funnel.error).not.toBeNull()
    expect(funnel.error?.code).toBe('42501')
  })

  it('refuses weekly_activity() and funnel_counts() to anon', async () => {
    const anon = anonClient()
    const weekly = await anon.rpc('weekly_activity')
    expect(weekly.error).not.toBeNull()
    const funnel = await anon.rpc('funnel_counts', { since: '2026-01-01T00:00:00Z' })
    expect(funnel.error).not.toBeNull()
  })

  it('answers the service role with one row of counts', async () => {
    const weekly = await admin.rpc('weekly_activity')
    expect(weekly.error).toBeNull()
    expect(weekly.data).toHaveLength(1)
    // A created items and a subject state earlier in this file.
    expect(Number(weekly.data?.[0]?.active_users)).toBeGreaterThanOrEqual(1)

    const funnel = await admin.rpc('funnel_counts', { since: '2000-01-01T00:00:00Z' })
    expect(funnel.error).toBeNull()
    expect(funnel.data).toHaveLength(1)
    expect(Number(funnel.data?.[0]?.signups)).toBeGreaterThanOrEqual(2)
    expect(Number(funnel.data?.[0]?.onboarded)).toBeGreaterThanOrEqual(1)
    expect(Number(funnel.data?.[0]?.with_item)).toBeGreaterThanOrEqual(1)
  })
})

describe('delete_my_account()', () => {
  it('is refused to anon', async () => {
    const { error } = await anonClient().rpc('delete_my_account')
    expect(error).not.toBeNull()
  })

  it('deletes only the caller and cascades their items, states and resources', async () => {
    const userC = await createUser('c')
    try {
      const item = await userC.client
        .from('academic_items')
        .insert({ user_id: userC.id, kind: 'midterm', title: 'Parcial de C' })
      expect(item.error).toBeNull()
      const state = await userC.client.from('user_subject_states').insert({
        user_id: userC.id,
        curriculum_subject_id: curriculumSubjectId,
        status: 'in_progress',
      })
      expect(state.error).toBeNull()
      const resource = await userC.client.from('resources').insert({
        user_id: userC.id,
        kind: 'note',
        title: 'Apunte de C',
        body: 'texto',
      })
      expect(resource.error).toBeNull()

      const { count: aItemsBefore } = await admin
        .from('academic_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userA.id)
      expect(aItemsBefore).toBeGreaterThan(0)

      const { error } = await userC.client.rpc('delete_my_account')
      expect(error).toBeNull()

      const { data: gone } = await admin.auth.admin.getUserById(userC.id)
      expect(gone.user).toBeNull()
      for (const table of ['academic_items', 'user_subject_states', 'resources'] as const) {
        const { count } = await admin
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userC.id)
        expect(count, table).toBe(0)
      }
      const { count: profileCount } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('id', userC.id)
      expect(profileCount).toBe(0)

      // The other students are untouched.
      const { data: other } = await admin.auth.admin.getUserById(userA.id)
      expect(other.user?.id).toBe(userA.id)
      const { count: aItemsAfter } = await admin
        .from('academic_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userA.id)
      expect(aItemsAfter).toBe(aItemsBefore)
      const { count: aResources } = await admin
        .from('resources')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userA.id)
      expect(aResources).toBe(1)
    } finally {
      await admin.auth.admin.deleteUser(userC.id).catch(() => undefined)
    }
  })
})
