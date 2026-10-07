import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }))

import { AuthProvider, useAuth } from './auth-context'

function capture() {
  let value!: ReturnType<typeof useAuth>
  function Probe() {
    value = useAuth()
    return null
  }
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
  return () => value
}

describe('signUp on a hosted project', () => {
  it('sends the confirmation link back to THIS origin, at /login', async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null })
    const get = capture()

    await act(async () => {
      await get().signUp('a@b.com', 'secret1', 'Cami')
    })

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret1',
      options: {
        data: { display_name: 'Cami' },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
  })

  it('reports that e-mail confirmation is pending when no session comes back', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
    const get = capture()

    let result!: Awaited<ReturnType<ReturnType<typeof useAuth>['signUp']>>
    await act(async () => {
      result = await get().signUp('a@b.com', 'secret1', 'Cami')
    })

    expect(result).toEqual({ error: null, needsConfirmation: true })
  })

  it('does not ask for confirmation when the session is already there', async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null })
    const get = capture()

    let result!: Awaited<ReturnType<ReturnType<typeof useAuth>['signUp']>>
    await act(async () => {
      result = await get().signUp('a@b.com', 'secret1', 'Cami')
    })

    expect(result).toEqual({ error: null, needsConfirmation: false })
  })

  it.each([
    [
      'For security purposes, you can only request this after 42 seconds.',
      /Demasiados intentos/,
    ],
    ['Signups not allowed for this instance', /registro.*deshabilitado/i],
  ])('translates the hosted-only error %j', async (message, expected) => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: { message } })
    const get = capture()

    let result!: Awaited<ReturnType<ReturnType<typeof useAuth>['signUp']>>
    await act(async () => {
      result = await get().signUp('a@b.com', 'secret1', 'Cami')
    })

    expect(result.error).toMatch(expected)
    expect(result.needsConfirmation).toBe(false)
  })
})
