#!/usr/bin/env node
/**
 * P1-05 — prove the Vault API refuses to start on a non-loopback bind.
 *
 * The unit matrix in `bind-guard.test.ts` proves the classifier. This proves the
 * WIRING: that a real `vite --host` actually fails, loudly, instead of starting
 * with a filesystem API on every interface.
 */
import process from 'node:process'

import { startDevServer, waitForPortFree } from './lib/dev-server.mjs'

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`  ${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log('\nP1-05 — Vault API bind guard')

await waitForPortFree(5173)

// A) the ordinary developer path must keep working
const ok = await startDevServer({ args: ['dev'] })
check('`pnpm dev` starts on loopback', ok.ready, ok.url ?? ok.output.slice(-160))
if (ok.ready) check('bound to loopback', /127\.0\.0\.1|\[::1\]/.test(ok.url ?? ''), ok.url)
await ok.stop()
await waitForPortFree(5173)

// B) --host must be refused, loudly
const unsafe = await startDevServer({ args: ['vite', '--host'], expectFailure: true })
check(
  '`vite --host` is REFUSED',
  !unsafe.ready && unsafe.exitCode !== null,
  `exit=${unsafe.exitCode}`,
)
check('the refusal explains itself', /Campus refuses to start/.test(unsafe.output))
check('it names the danger', /read and write your files/i.test(unsafe.output))
check(
  'it names both ways out',
  /--host/.test(unsafe.output) && /CAMPUS_VAULT_API=off/.test(unsafe.output),
)
check(
  'it did NOT silently disable the API and start anyway',
  !/ready in/.test(unsafe.output),
  'a silent downgrade teaches everyone to delete the check',
)
await unsafe.stop()
await waitForPortFree(5173)

// C) the documented opt-out: frontend on the network, no filesystem API
const optOut = await startDevServer({
  args: ['vite', '--host'],
  env: { CAMPUS_VAULT_API: 'off' },
})
check(
  'CAMPUS_VAULT_API=off allows --host for CLOUD-only',
  optOut.ready,
  optOut.url ?? optOut.output.slice(-160),
)
if (optOut.ready) {
  const html = await fetch(optOut.url).then((r) => r.text())
  check('and injects NO capability token', !html.includes('__CAMPUS_VAULT_TOKEN__'))
  const probe = await fetch(`${optOut.url}/__campus/vault/open`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: '/tmp' }),
  })
  check('and the endpoint is not mounted', probe.status === 404, `status=${probe.status}`)
}
await optOut.stop()
await waitForPortFree(5173)

const failed = results.filter((r) => !r).length
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${results.length - failed}/${results.length}`)
process.exit(failed === 0 ? 0 : 1)
