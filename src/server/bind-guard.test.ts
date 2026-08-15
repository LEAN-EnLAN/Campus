import { describe, expect, it } from 'vitest'

import { assertLoopbackBind, classifyBind, UnsafeVaultBindError } from './bind-guard'

/**
 * P1-05 — the Vault API may only ever listen on loopback.
 *
 * The matrix is the point. A guard that accepts `127.0.0.1` and rejects
 * `0.0.0.0` while quietly accepting `::` or a LAN address is not a guard, and
 * the failure mode is invisible until someone's files are on the network.
 */

describe('loopback is allowed', () => {
  const SAFE: [string | boolean | undefined, string][] = [
    [undefined, 'Vite default'],
    [false, 'server.host: false'],
    ['127.0.0.1', 'IPv4 loopback'],
    ['localhost', 'hostname'],
    ['::1', 'IPv6 loopback'],
    ['[::1]', 'bracketed IPv6'],
    ['127.0.0.53', 'anywhere in 127.0.0.0/8'],
    ['LOCALHOST', 'case does not matter'],
    [' 127.0.0.1 ', 'whitespace does not matter'],
  ]

  it.each(SAFE)('%s (%s)', (host) => {
    expect(classifyBind(host).safe).toBe(true)
  })
})

describe('anything reachable from the network is refused', () => {
  const UNSAFE: [string | boolean, string][] = [
    [true, '`vite --host`'],
    ['0.0.0.0', 'IPv4 wildcard'],
    ['::', 'IPv6 wildcard'],
    ['[::]', 'bracketed IPv6 wildcard'],
    ['192.168.1.42', 'LAN address'],
    ['10.0.0.5', 'private range'],
    ['100.102.107.60', 'tailnet address'],
    ['casa.tail61165e.ts.net', 'MagicDNS name'],
    ['0.0.0.0:5173', 'host with a port'],
    ['example.com', 'public name'],
  ]

  it.each(UNSAFE)('%s (%s)', (host) => {
    const verdict = classifyBind(host)
    expect(verdict.safe, `${String(host)} was accepted`).toBe(false)
    expect(verdict.reason.length).toBeGreaterThan(0)
  })

  it('is not fooled by a name that merely contains "localhost"', () => {
    // `localhost.evil.example` resolves wherever its owner wants.
    expect(classifyBind('localhost.evil.example').safe).toBe(false)
    expect(classifyBind('notlocalhost').safe).toBe(false)
  })

  it('is not fooled by an address that merely starts with 127', () => {
    // 127 is only loopback in the first octet.
    expect(classifyBind('1270.0.0.1').safe).toBe(false)
    expect(classifyBind('12.7.0.1').safe).toBe(false)
  })
})

describe('the refusal is loud and explains itself', () => {
  it('throws rather than silently disabling the API', () => {
    // A silent downgrade teaches everyone the flag "sometimes works", and the
    // next person debugs it by deleting the check.
    expect(() => assertLoopbackBind('0.0.0.0')).toThrow(UnsafeVaultBindError)
  })

  it('names the host, the reason, and the two ways out', () => {
    try {
      assertLoopbackBind(true)
      throw new Error('should have refused')
    } catch (error) {
      const message = (error as Error).message
      expect(message).toContain('0.0.0.0')
      expect(message).toMatch(/read and write your files/i)
      expect(message).toMatch(/--host/)
      expect(message).toMatch(/CAMPUS_VAULT_API=off/)
    }
  })

  it('returns the verdict when the bind is safe', () => {
    expect(assertLoopbackBind('127.0.0.1').safe).toBe(true)
  })
})
