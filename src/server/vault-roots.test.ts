import { delimiter, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isInsideAny, parseAllowedRoots } from './vault-roots'

describe('parseAllowedRoots', () => {
  const HOME = '/home/estudiante'

  it('defaults to the home directory when nothing is set', () => {
    expect(parseAllowedRoots(undefined, HOME).roots).toEqual([HOME])
    expect(parseAllowedRoots('', HOME).roots).toEqual([HOME])
    expect(parseAllowedRoots('   ', HOME).roots).toEqual([HOME])
  })

  it('an explicit list REPLACES the default, it does not extend it', () => {
    const { roots } = parseAllowedRoots(['/srv/vaults', '/mnt/usb'].join(delimiter), HOME)
    expect(roots).toEqual(['/srv/vaults', '/mnt/usb'])
  })

  it('normalises trailing slashes and dot segments', () => {
    expect(parseAllowedRoots('/srv/vaults/', HOME).roots).toEqual(['/srv/vaults'])
    expect(parseAllowedRoots('/srv/./vaults/../vaults', HOME).roots).toEqual(['/srv/vaults'])
  })

  it('drops what could never match instead of keeping a knob that is set but inert', () => {
    const raw = ['relative/dir', '~/vaults', '', '/ok', '/bad\0nul', '*'].join(delimiter)
    const { roots, rejected } = parseAllowedRoots(raw, HOME)
    expect(roots).toEqual(['/ok'])
    expect(rejected).toEqual(['relative/dir', '~/vaults', '/bad\0nul', '*'])
  })

  it('refuses the filesystem root: an allowlist of "/" allows everything', () => {
    const { roots, rejected } = parseAllowedRoots('/', HOME)
    expect(roots).toEqual([])
    expect(rejected).toEqual(['/'])
  })

  it('a value that parses to nothing allows nothing; it never falls back to the default', () => {
    expect(parseAllowedRoots('relative', HOME).roots).toEqual([])
  })
})

describe('isInsideAny', () => {
  it('matches the root itself and anything below it', () => {
    expect(isInsideAny(['/home/a'], '/home/a')).toBe(true)
    expect(isInsideAny(['/home/a'], '/home/a/vault/deep')).toBe(true)
  })

  it('does not match a sibling that shares the prefix, or the parent', () => {
    expect(isInsideAny(['/home/a'], '/home/ab')).toBe(false)
    expect(isInsideAny(['/home/a'], '/home')).toBe(false)
    expect(isInsideAny(['/home/a'], '/etc')).toBe(false)
  })

  it('collapses dot segments before judging', () => {
    expect(isInsideAny(['/home/a'], resolve('/home/a/../../etc'))).toBe(false)
  })

  it('an empty list allows nothing', () => {
    expect(isInsideAny([], '/home/a')).toBe(false)
  })
})
