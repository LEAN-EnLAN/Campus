#!/usr/bin/env node
/**
 * Pre/post-deploy guard for the hosted (Vercel) build. See docs/DEPLOY.md.
 *
 *   node scripts/deploy-check.mjs                      scan ./dist
 *   node scripts/deploy-check.mjs --dist <dir>         scan another build output
 *   node scripts/deploy-check.mjs --url https://x.vercel.app
 *                                                      smoke-test a live deployment
 *
 * Bundle scan: everything under the build output is PUBLIC, so it must not carry
 * the tester password/accounts, a service-role key, or a URL of the local stack.
 * Live check: deep links resolve to the SPA, a missing hashed asset is a real
 * 404 (not HTML), and hashed assets are cached as immutable.
 *
 * Exits 0 when everything passes, 1 otherwise.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: { dist: { type: 'string' }, url: { type: 'string' } },
})

const failures = []
const fail = (message) => failures.push(message)

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/\.(js|mjs|css|html|json|map)$/.test(entry)) yield full
  }
}

/** Decode the payload of anything shaped like a JWT; `null` if it is not one. */
function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

function scanBundle(dir) {
  if (!existsSync(join(dir, 'index.html'))) {
    fail(`no build output at ${dir} (index.html missing) — run \`pnpm build\` first`)
    return
  }
  const forbidden = [
    [/campus-tester/, 'the published tester password ("campus-tester")'],
    [/tester\.campus\.local/, 'a tester account e-mail (tester.campus.local)'],
    [/(127\.0\.0\.1|localhost):54321/, 'the URL of the local Supabase stack'],
  ]
  for (const file of walk(dir)) {
    const text = readFileSync(file, 'utf8')
    for (const [pattern, what] of forbidden) {
      if (pattern.test(text)) fail(`${file}: contains ${what}`)
    }
    for (const token of text.match(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g) ?? []) {
      if (jwtRole(token) === 'service_role') fail(`${file}: contains a service_role key`)
    }
  }
}

async function checkLive(base) {
  const origin = base.replace(/\/+$/, '')
  const get = (path) => fetch(`${origin}${path}`, { redirect: 'manual' })

  const home = await get('/')
  const html = await home.text()
  if (home.status !== 200) fail(`GET / answered ${home.status}, expected 200`)

  const deep = await get('/today')
  if (deep.status !== 200 || !(await deep.text()).includes('<div id="root"')) {
    fail(
      `GET /today did not serve the SPA shell (status ${deep.status}): deep links need the rewrite`,
    )
  }

  const missing = await get('/assets/this-file-does-not-exist.js')
  if (missing.status !== 404) {
    fail(
      `a missing asset answered ${missing.status}, expected 404 — it is being rewritten to HTML`,
    )
  }

  const asset = html.match(/\/assets\/[^"']+\.js/)?.[0]
  if (!asset) {
    fail('index.html references no /assets/*.js bundle')
  } else {
    const cache = (await get(asset)).headers.get('cache-control') ?? ''
    if (!/max-age=31536000/.test(cache) || !/immutable/.test(cache)) {
      fail(`${asset} has Cache-Control "${cache}", expected a year and immutable`)
    }
  }
}

if (values.dist !== undefined || values.url === undefined) scanBundle(values.dist ?? 'dist')
if (values.url !== undefined) {
  try {
    await checkLive(values.url)
  } catch (error) {
    fail(`could not reach ${values.url}: ${error instanceof Error ? error.message : error}`)
  }
}

if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL  ${message}`)
  process.exit(1)
}
console.log('deploy-check: OK')
