import { describe, expect, it } from 'vitest'

import { extraAllowedOrigins, vaultAllowedOrigins } from './vault-origins'

/**
 * The Vault API answers only to origins on this list, and the list is
 * loopback-only by default — the student's filesystem is never reachable from
 * another machine unless someone wrote that machine down on purpose. These
 * tests pin both halves: the default stays closed, and the opt-in is strict
 * about what it accepts.
 */
describe('vaultAllowedOrigins — the default is loopback, nothing else', () => {
  it('lists exactly the three loopback names on the served scheme and port', () => {
    expect(vaultAllowedOrigins('http', 5173, undefined)).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://[::1]:5173',
    ])
  })

  it('does NOT contain a tailnet or LAN origin unless one is opted in', () => {
    // This is the test that would have caught a well-meaning "just add it to
    // the array" — the default has to keep refusing.
    const list = vaultAllowedOrigins('http', 5173, undefined)
    expect(list.some((o) => o.includes('ts.net'))).toBe(false)
    expect(list).toHaveLength(3)
  })

  it('appends the opted-in origins after the loopback ones', () => {
    expect(vaultAllowedOrigins('http', 5173, 'https://casa.tail61165e.ts.net')).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://[::1]:5173',
      'https://casa.tail61165e.ts.net',
    ])
  })
})

describe('extraAllowedOrigins — the opt-in is a deliberate act, so it is strict', () => {
  it('accepts a comma-separated list and trims it', () => {
    expect(
      extraAllowedOrigins(
        ' https://casa.tail61165e.ts.net , https://iphone.tail61165e.ts.net ',
      ),
    ).toEqual(['https://casa.tail61165e.ts.net', 'https://iphone.tail61165e.ts.net'])
  })

  it('normalises a trailing slash away, because Origin headers never carry one', () => {
    // `https://host/` in the env would never equal the browser's
    // `https://host`, and the student would stare at a 403 with the "right"
    // value visibly set. Silent mismatches are the worst kind.
    expect(extraAllowedOrigins('https://casa.tail61165e.ts.net/')).toEqual([
      'https://casa.tail61165e.ts.net',
    ])
  })

  it('refuses anything that is not a full origin', () => {
    // A bare host has no scheme, so it can never match an Origin header; a
    // path or query means it is a URL, not an origin. Dropping them loudly is
    // better than "allowing" a value that can never be sent.
    for (const junk of [
      'casa.tail61165e.ts.net',
      'https://casa.tail61165e.ts.net/vault',
      'https://casa.tail61165e.ts.net?x=1',
      'ftp://casa.tail61165e.ts.net',
      '*',
      'https://',
    ]) {
      expect(extraAllowedOrigins(junk), junk).toEqual([])
    }
  })

  it('never lets a wildcard through', () => {
    expect(extraAllowedOrigins('*')).toEqual([])
    expect(extraAllowedOrigins('https://*.ts.net')).toEqual([])
  })

  it('is empty for an unset or blank variable', () => {
    expect(extraAllowedOrigins(undefined)).toEqual([])
    expect(extraAllowedOrigins('')).toEqual([])
    expect(extraAllowedOrigins('  ,  , ')).toEqual([])
  })
})
