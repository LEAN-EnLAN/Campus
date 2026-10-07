import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const run = promisify(execFile)

/**
 * The verify scripts normally own port 5173. On a machine where a developer's own
 * server already sits there they must not test (or kill) that one, so
 * CAMPUS_VERIFY_PORT moves them to another port: the script waits on it, probes it
 * and tells vite to bind it.
 */
async function ask(expression: string, env: Record<string, string>) {
  const { stdout } = await run(
    'node',
    [
      '--input-type=module',
      '-e',
      `import * as dev from './scripts/lib/dev-server.mjs'; console.log(JSON.stringify(${expression}))`,
    ],
    { cwd: process.cwd(), env: { ...process.env, CAMPUS_VERIFY_PORT: '', ...env } },
  )
  return JSON.parse(stdout) as unknown
}

describe('the port the verify scripts use', () => {
  it('is 5173 unless asked otherwise', async () => {
    expect(await ask('dev.DEV_PORT', {})).toBe(5173)
    expect(await ask("dev.withPort(['dev'], 5173)", {})).toEqual(['dev'])
  })

  it('follows CAMPUS_VERIFY_PORT', async () => {
    expect(await ask('dev.DEV_PORT', { CAMPUS_VERIFY_PORT: '5299' })).toBe(5299)
  })

  it('ignores a value that is not a port', async () => {
    expect(await ask('dev.DEV_PORT', { CAMPUS_VERIFY_PORT: 'abc' })).toBe(5173)
    expect(await ask('dev.DEV_PORT', { CAMPUS_VERIFY_PORT: '70000' })).toBe(5173)
  })

  it('tells vite which port to bind, and nothing else changes', async () => {
    expect(await ask("dev.withPort(['dev'], 5299)", {})).toEqual(['dev', '--port', '5299'])
    expect(await ask("dev.withPort(['vite', '--host'], 5299)", {})).toEqual([
      'vite',
      '--host',
      '--port',
      '5299',
    ])
  })
})
