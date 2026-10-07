import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ConfigError } from './config-error'
import { missingSupabaseConfig } from './config-check'

describe('missingSupabaseConfig', () => {
  it('reports nothing when both values are set', () => {
    expect(
      missingSupabaseConfig({
        VITE_SUPABASE_URL: 'https://x.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'k',
      }),
    ).toEqual([])
  })

  it('names each missing variable, treating blank as missing', () => {
    expect(missingSupabaseConfig({})).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
    expect(
      missingSupabaseConfig({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toEqual(['VITE_SUPABASE_URL'])
  })
})

describe('ConfigError', () => {
  it('says in Spanish what is missing and how to fix it, instead of a blank page', () => {
    render(<ConfigError missing={['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']} />)

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Campus no está configurado' })).toBeTruthy()
    expect(screen.getByText('VITE_SUPABASE_URL')).toBeTruthy()
    expect(screen.getByText('VITE_SUPABASE_ANON_KEY')).toBeTruthy()
    // The values are inlined at build time: setting them is not enough.
    expect(screen.getByText(/volvé a desplegar/i)).toBeTruthy()
  })
})
