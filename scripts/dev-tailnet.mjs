#!/usr/bin/env node
/**
 * `pnpm dev:tailnet` — dev server reachable from your other Tailscale devices.
 *
 * The problem this solves: `VITE_SUPABASE_URL` is baked into the client at load
 * time. Serving the app on the tailnet while it still points at `127.0.0.1:54321`
 * means a phone asks *itself* for the database and every screen fails. So the
 * Supabase URL has to be rewritten to the same tailnet address the app is served
 * from.
 *
 * Binds to the Tailscale IP specifically, not `0.0.0.0`: only the tailnet reaches
 * it, not the whole LAN.
 *
 * This is tailnet-only. It does NOT use `tailscale funnel`, which would publish
 * the dev server to the public internet.
 */
import { execFileSync, spawn } from 'node:child_process'
import process from 'node:process'

function sh(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function tailnetIp() {
  try {
    // `tailscale ip -4` prints a version-skew warning to stderr on this box; the
    // address is on stdout, so take the first line that looks like a CGNAT address.
    const out = sh('tailscale', ['ip', '-4'])
    const ip = out.split('\n').find((line) => /^100\.\d+\.\d+\.\d+$/.test(line.trim()))
    if (!ip) throw new Error(`could not parse an address from:\n${out}`)
    return ip.trim()
  } catch (error) {
    console.error(
      '\n[dev:tailnet] Tailscale did not give me an address.\n' +
        'Is it up? Try `tailscale status`.\n\n' +
        (error instanceof Error ? error.message : String(error)),
    )
    process.exit(1)
  }
}

function dnsName() {
  try {
    const json = JSON.parse(sh('tailscale', ['status', '--json']))
    return (json.Self?.DNSName ?? '').replace(/\.$/, '') || null
  } catch {
    return null
  }
}

function supabaseStatus() {
  try {
    return JSON.parse(sh('./node_modules/.bin/supabase', ['status', '-o', 'json']))
  } catch {
    console.error(
      '\n[dev:tailnet] The local Supabase stack is not running.\n' +
        'Start it with `pnpm db:start` — without it the app has no database to talk to.\n',
    )
    process.exit(1)
  }
}

const ip = tailnetIp()
const dns = dnsName()
const status = supabaseStatus()

const apiPort = new URL(status.API_URL).port || '54321'
const supabaseUrl = `http://${ip}:${apiPort}`

console.log('')
console.log('  Campus · dev server en el tailnet')
console.log('  ─────────────────────────────────')
console.log(`  app        http://${ip}:5173`)
if (dns) console.log(`             http://${dns}:5173`)
console.log(`  supabase   ${supabaseUrl}`)
console.log(`  tester     http://${ip}:5173/dev`)
console.log('')
console.log('  Sólo alcanzable desde tu tailnet. No usa Funnel: nada público.')
console.log('')

const child = spawn(
  './node_modules/.bin/vite',
  ['--host', ip, '--port', '5173', '--strictPort'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Vite picks VITE_-prefixed vars up from the environment and they win over
      // .env, so the committed local-only file stays untouched.
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: status.ANON_KEY,
      VITE_CAMPUS_TESTER: process.env.VITE_CAMPUS_TESTER ?? '1',
    },
  },
)

child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
child.on('error', (error) => {
  console.error(`[dev:tailnet] could not start vite: ${error.message}`)
  process.exit(1)
})
