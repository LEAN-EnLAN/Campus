#!/usr/bin/env node
/**
 * Run a command with the LOCAL Supabase keys injected from `supabase status`.
 *
 * Keys are read at run time rather than committed, so the DB suite works on any
 * machine and no key ever lands in git. If the stack is not up, this fails loudly
 * — a database test that cannot reach a database is not evidence.
 *
 *   node scripts/with-supabase-env.mjs vitest run --config vitest.db.config.ts
 */
import { execFileSync, spawn } from 'node:child_process'
import process from 'node:process'

const SUPABASE_BIN = './node_modules/.bin/supabase'

function readStatus() {
  try {
    const raw = execFileSync(SUPABASE_BIN, ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return JSON.parse(raw)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error(
      '\n[with-supabase-env] Could not read local Supabase status.\n' +
        'The local stack is required for database/RLS evidence.\n' +
        'Start it with:  pnpm db:start\n\n' +
        detail +
        '\n',
    )
    process.exit(1)
  }
}

const status = readStatus()

const env = {
  ...process.env,
  SUPABASE_URL: status.API_URL ?? 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: status.ANON_KEY ?? '',
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY ?? '',
  SUPABASE_DB_URL: status.DB_URL ?? '',
}

if (!env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[with-supabase-env] Supabase is running but returned no keys.')
  process.exit(1)
}

const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('[with-supabase-env] usage: with-supabase-env <command> [...args]')
  process.exit(1)
}

const child = spawn(command, args, { env, stdio: 'inherit', shell: false })
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)))
child.on('error', (error) => {
  console.error(`[with-supabase-env] failed to spawn ${command}: ${error.message}`)
  process.exit(1)
})
