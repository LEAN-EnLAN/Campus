import { execFile } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { delimiter, resolve } from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

import { parseAllowedRoots } from '../../src/server/vault-roots'

const run = promisify(execFile)

/**
 * The verify scripts open vaults under /tmp, but the Vault API only opens
 * folders under the allowed roots (default: home). The dev server they spawn
 * therefore has to be told, or every journey dies at "outside the roots".
 */
async function devServerEnv(callerEnv: Record<string, string>, processRoots?: string) {
  const { stdout } = await run(
    'node',
    [
      '--input-type=module',
      '-e',
      `import { devServerEnv } from './scripts/lib/dev-server.mjs'
       console.log(JSON.stringify(devServerEnv(${JSON.stringify(callerEnv)})))`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CAMPUS_VAULT_ALLOWED_ROOTS: processRoots ?? '',
      },
    },
  )
  return JSON.parse(stdout) as Record<string, string>
}

describe('dev server spawned by the verify scripts', () => {
  it('allows home and the temp folders the scripts build their vaults in', async () => {
    const env = await devServerEnv({})
    const { roots, rejected } = parseAllowedRoots(env.CAMPUS_VAULT_ALLOWED_ROOTS, homedir())

    expect(rejected).toEqual([])
    expect(roots).toContain(resolve(homedir()))
    expect(roots).toContain(resolve(tmpdir()))
    expect(roots).toContain('/tmp')
    expect(env.CAMPUS_VAULT_ALLOWED_ROOTS).toContain(delimiter)
  })

  it('never widens to the filesystem root', async () => {
    const env = await devServerEnv({})
    expect(parseAllowedRoots(env.CAMPUS_VAULT_ALLOWED_ROOTS, homedir()).roots).not.toContain(
      '/',
    )
  })

  it('keeps an explicit list from the caller exactly as given', async () => {
    const env = await devServerEnv({ CAMPUS_VAULT_ALLOWED_ROOTS: '/srv/only' })
    expect(env.CAMPUS_VAULT_ALLOWED_ROOTS).toBe('/srv/only')
  })

  it('keeps an explicit list from the operator environment', async () => {
    const env = await devServerEnv({}, '/mnt/vaults')
    expect(env.CAMPUS_VAULT_ALLOWED_ROOTS).toBe('/mnt/vaults')
  })
})
