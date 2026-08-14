#!/usr/bin/env node
/**
 * `pnpm dev:tailnet` — dev server reachable over HTTPS from your Tailscale devices.
 *
 * Three problems this solves, in order of how much time each one costs you:
 *
 * 1. **HTTPS is not optional.** Browsers with HTTPS-First upgrade
 *    `http://host:5173` to HTTPS and then fail the handshake against a plain-HTTP
 *    dev server — `ERR_SSL_PROTOCOL_ERROR`, on every URL, which looks like the
 *    server is down when it is answering 200 perfectly well. So the dev server
 *    serves TLS with a self-signed cert covering both the tailnet IP and the
 *    MagicDNS name. You accept the warning once per device.
 *
 *    `tailscale serve` would give a properly trusted cert with no warning, but it
 *    needs root. The command is printed at the end if you want it.
 *
 * 2. **`VITE_SUPABASE_URL` is baked into the client.** Serving the app on the
 *    tailnet while it points at `127.0.0.1:54321` makes a phone ask *itself* for
 *    the database. Here Supabase is proxied through this same origin at
 *    `/supabase-api`, so there is no second URL to get wrong, no mixed content,
 *    no CORS — and the database API never has to be reachable from the network.
 *
 * 3. **HMR breaks behind TLS** unless it is told to use `wss`.
 *
 * Tailnet only. This never touches `tailscale funnel`, which would publish the
 * dev server to the public internet.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const CERT_DIR = '.certs'
const CERT = join(CERT_DIR, 'tailnet-cert.pem')
const KEY = join(CERT_DIR, 'tailnet-key.pem')
const PORT = 5173

function sh(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function fail(lines) {
  console.error(`\n[dev:tailnet] ${lines.join('\n')}\n`)
  process.exit(1)
}

/**
 * Every address on this machine another device could reach, excluding container
 * bridges. A tailnet address only helps if the other device is ON the tailnet —
 * and a laptop with Tailscale closed is the single most common reason "I cannot
 * see it" — so the LAN address has to be offered too.
 */
function reachableAddresses() {
  const SKIP = /^(lo|docker|br-|veth|virbr|wt)/
  try {
    const rows = JSON.parse(sh('ip', ['-j', '-4', 'addr', 'show', 'scope', 'global']))
    const out = []
    for (const row of rows) {
      if (SKIP.test(row.ifname)) continue
      for (const info of row.addr_info ?? []) {
        if (info.family !== 'inet') continue
        out.push({ iface: row.ifname, ip: info.local })
      }
    }
    return out
  } catch {
    return []
  }
}

function tailnet() {
  let ip = null
  let dns = null
  try {
    // `tailscale ip -4` also warns about version skew on stderr; the address is on
    // stdout, so pick the line that looks like a CGNAT address.
    ip =
      sh('tailscale', ['ip', '-4'])
        .split('\n')
        .map((l) => l.trim())
        .find((l) => /^100\.\d+\.\d+\.\d+$/.test(l)) ?? null
    const json = JSON.parse(sh('tailscale', ['status', '--json']))
    dns = (json.Self?.DNSName ?? '').replace(/\.$/, '') || null
  } catch (error) {
    fail(['Tailscale did not answer. Is it up? Try `tailscale status`.', String(error)])
  }
  if (!ip) fail(['Tailscale is running but gave me no IPv4 address.'])
  return { ip, dns }
}

function supabaseStatus() {
  try {
    return JSON.parse(sh('./node_modules/.bin/supabase', ['status', '-o', 'json']))
  } catch {
    fail([
      'The local Supabase stack is not running.',
      'Start it with `pnpm db:start` — without it the app has no database to talk to.',
    ])
  }
}

/**
 * A self-signed cert valid for the tailnet IP and the MagicDNS name.
 *
 * Regenerated when it is missing or older than 300 days. Not committed: it is a
 * machine-local development credential.
 */
function ensureCert({ dns, addresses }) {
  mkdirSync(CERT_DIR, { recursive: true })

  const names = [
    dns ? `DNS:${dns}` : null,
    'DNS:localhost',
    ...addresses.map((a) => `IP:${a.ip}`),
    'IP:127.0.0.1',
  ].filter(Boolean)

  // Regenerate whenever the address set changed, not just on age: a certificate
  // that does not cover the address you typed fails the handshake, and a failed
  // handshake is indistinguishable from a dead server.
  let covered = false
  if (existsSync(CERT) && existsSync(KEY)) {
    try {
      const san = sh('openssl', ['x509', '-in', CERT, '-noout', '-ext', 'subjectAltName'])
      covered = names.every((n) =>
        san.includes(n.startsWith('IP:') ? `IP Address:${n.slice(3)}` : n),
      )
    } catch {
      covered = false
    }
  }
  if (covered) return

  try {
    sh('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-sha256',
      '-days',
      '365',
      '-nodes',
      '-keyout',
      KEY,
      '-out',
      CERT,
      '-subj',
      `/CN=${dns ?? addresses[0]?.ip ?? 'localhost'}`,
      '-addext',
      `subjectAltName=${names.join(',')}`,
    ])
    console.log(`  cert generado para ${names.join(', ')}`)
  } catch (error) {
    fail(['Could not generate a TLS certificate with openssl.', String(error)])
  }
}

const { ip, dns } = tailnet()
const status = supabaseStatus()
const addresses = reachableAddresses()
ensureCert({ dns, addresses })

const host = dns ?? ip
// Origin-RELATIVE on purpose. src/lib/supabase.ts resolves it against
// window.location.origin, so the app works identically whether you opened it by
// LAN IP, tailnet IP, MagicDNS name or localhost. An absolute host here sends a
// laptop without MagicDNS to a name it cannot resolve, and every query fails.
const supabaseUrl = '/supabase-api'

console.log('')
console.log('  Campus · dev server en el tailnet (HTTPS)')
console.log('  ─────────────────────────────────────────')
if (dns) console.log(`  tailnet    https://${dns}:${PORT}`)
for (const address of addresses) {
  console.log(
    `  ${(address.ip === ip ? 'tailnet' : 'LAN').padEnd(10)} https://${address.ip}:${PORT}`,
  )
}
console.log(`  tester     https://${host}:${PORT}/dev`)
console.log('')
console.log('  Si la URL de tailnet no abre, ese dispositivo no está conectado a')
console.log('  Tailscale — chequealo con `tailscale status` ahí. Usá la de LAN.')
console.log('')
console.log(`  supabase   proxeado por el mismo origen (${supabaseUrl}) → ${status.API_URL}`)
console.log('')
console.log('  El cert es autofirmado: la primera vez el browser te avisa.')
console.log('  Aceptás una vez por dispositivo y listo.')
console.log('')
console.log('  Para un cert de verdad, sin avisos (necesita root, una sola vez):')
console.log(`    sudo tailscale serve --bg --https=8443 https://127.0.0.1:${PORT}`)
console.log('')
console.log('  Sólo tailnet. No usa Funnel: nada público.')
console.log('')

const child = spawn(
  './node_modules/.bin/vite',
  // Every interface, not just the tailnet one: a laptop with Tailscale closed can
  // still reach this over the LAN, and "I cannot see it" is almost always that.
  ['--host', '0.0.0.0', '--port', String(PORT), '--strictPort'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CAMPUS_TLS_CERT: CERT,
      CAMPUS_TLS_KEY: KEY,
      CAMPUS_SUPABASE_TARGET: status.API_URL,
      CAMPUS_HMR_HOST: host,
      // Vite reads VITE_-prefixed vars from the environment and they win over
      // .env, so the local file stays untouched.
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: status.ANON_KEY,
      VITE_CAMPUS_TESTER: process.env.VITE_CAMPUS_TESTER ?? '1',
    },
  },
)

child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
child.on('error', (error) => fail([`could not start vite: ${error.message}`]))
