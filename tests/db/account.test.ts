import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

import { createSupabaseBackend } from '@/lib/backends/supabase-backend'
import type { CampusBackend } from '@/lib/backends/types'

/**
 * The CLOUD adapter's account capabilities against the real local stack: the
 * same RLS and grants the app meets, through a real user's JWT.
 *
 * Requires the local stack: `pnpm db:start && pnpm db:reset`.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

let client: SupabaseClient
let admin: SupabaseClient
let backend: CampusBackend
let userId: string

beforeAll(async () => {
  client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const email = `account-${Date.now()}-${Math.floor(Math.random() * 1e6)}@campus.test`
  const { data, error } = await client.auth.signUp({ email, password: 'campus-account-123' })
  if (error || !data.user) throw new Error(`signUp failed: ${error?.message}`)
  userId = data.user.id
  backend = createSupabaseBackend(client)
}, 60_000)

describe('SupabaseBackend — account capabilities', () => {
  it('starts with metrics consent off', async () => {
    expect(await backend.profile!.get()).toEqual({
      metricsConsent: false,
      metricsConsentAt: null,
    })
  })

  it('refuses an event without consent', async () => {
    await expect(backend.telemetry!.record('share_copied', 'ref12345')).rejects.toThrow()
  })

  it('stamps the moment of consent and then records events', async () => {
    await backend.profile!.setMetricsConsent(true)
    const profile = await backend.profile!.get()
    expect(profile.metricsConsent).toBe(true)
    expect(profile.metricsConsentAt).not.toBeNull()

    await backend.telemetry!.record('share_copied', 'ref12345')
    await backend.telemetry!.record('share_saved', null)
    const { count } = await admin
      .from('product_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    expect(count).toBe(2)
  })

  it('withdrawing consent clears the stamp and stops the next event', async () => {
    await backend.profile!.setMetricsConsent(false)
    expect(await backend.profile!.get()).toEqual({
      metricsConsent: false,
      metricsConsentAt: null,
    })
    await expect(backend.telemetry!.record('share_saved', 'ref12345')).rejects.toThrow()
  })

  it('sends feedback with the route and the app version', async () => {
    await backend.feedback!.send({
      body: '  Anda bárbaro  ',
      route: '/today',
      appVersion: '0.1.0',
    })
    const { data } = await admin
      .from('feedback')
      .select('body, route, app_version')
      .eq('user_id', userId)
    expect(data).toEqual([{ body: 'Anda bárbaro', route: '/today', app_version: '0.1.0' }])
  })

  it('refuses blank feedback before reaching the database', async () => {
    await expect(
      backend.feedback!.send({ body: '   ', route: null, appVersion: null }),
    ).rejects.toThrow('No pudimos enviar tu mensaje')
  })

  it('deletes the account and everything it owns', async () => {
    await backend.account!.delete()
    const { data } = await admin.auth.admin.getUserById(userId)
    expect(data.user).toBeNull()
    const { count } = await admin
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    expect(count).toBe(0)
  })
})

describe('signup checkbox — consent saved with the profile', () => {
  async function signUpWith(data: Record<string, unknown>) {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const email = `signup-${Date.now()}-${Math.floor(Math.random() * 1e6)}@campus.test`
    const signed = await anon.auth.signUp({
      email,
      password: 'campus-account-123',
      options: { data: { display_name: 'Cami', ...data } },
    })
    if (signed.error || !signed.data.user)
      throw new Error(`signUp failed: ${signed.error?.message}`)
    const id = signed.data.user.id
    const { data: row } = await admin
      .from('profiles')
      .select('display_name, metrics_consent, metrics_consent_at')
      .eq('id', id)
      .single()
    await admin.auth.admin.deleteUser(id)
    return row as {
      display_name: string | null
      metrics_consent: boolean
      metrics_consent_at: string | null
    }
  }

  it('stores consent and its moment when the box was ticked', async () => {
    const row = await signUpWith({ metrics_consent: true })
    expect(row.display_name).toBe('Cami')
    expect(row.metrics_consent).toBe(true)
    expect(row.metrics_consent_at).not.toBeNull()
  })

  it('leaves consent off when the box was not ticked', async () => {
    const row = await signUpWith({})
    expect(row).toEqual({
      display_name: 'Cami',
      metrics_consent: false,
      metrics_consent_at: null,
    })
  })

  it('only the JSON value true counts as consent', async () => {
    const row = await signUpWith({ metrics_consent: 'yes' })
    expect(row.metrics_consent).toBe(false)
  })
})
