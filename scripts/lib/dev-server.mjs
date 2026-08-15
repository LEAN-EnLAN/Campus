import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'

/**
 * Start a dev server, wait for it to actually serve, and always clean up.
 *
 * Written because the ad-hoc alternatives each failed in a way that cost real
 * time:
 *
 *   - an unbounded `until curl ...; do sleep 1; done` span for ten minutes
 *     against a server that had already exited on "port in use". A readiness
 *     loop that cannot see the child die is not a readiness loop.
 *   - `pkill -f vite` matched the shell running the command, because that
 *     shell's own command line contains "vite". Killing by pattern kills the
 *     hunter.
 *
 * So: this owns the child, watches for its exit, bounds the wait, and stops it
 * by pid.
 */

/** Is something accepting TCP connections here? Cheaper and more honest than an HTTP probe. */
function probe(port, host, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host })
    const done = (ok) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

export async function portInUse(port, host = '127.0.0.1') {
  return (await probe(port, host)) || (await probe(port, '::1'))
}

/**
 * @param {object} options
 * @param {string[]} options.args        arguments after `pnpm`
 * @param {Record<string,string>} [options.env]
 * @param {number} [options.port]
 * @param {number} [options.timeoutMs]
 * @param {boolean} [options.expectFailure] resolve on exit instead of on readiness
 */
export async function startDevServer({
  args = ['dev'],
  env = {},
  port = 5173,
  timeoutMs = 30_000,
  cwd = process.cwd(),
  expectFailure = false,
} = {}) {
  const child = spawn('pnpm', args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  child.stdout.on('data', (c) => (output += c.toString()))
  child.stderr.on('data', (c) => (output += c.toString()))

  let exited = null
  child.on('exit', (code) => (exited = code ?? -1))

  const stop = async () => {
    if (exited !== null) return
    // By pid. Never by pattern: the pattern matches whoever is looking.
    child.kill('SIGTERM')
    for (let i = 0; i < 40 && exited === null; i += 1) {
      await new Promise((r) => setTimeout(r, 50))
    }
    if (exited === null) child.kill('SIGKILL')
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    // Checked FIRST, so a child that died on startup is reported as a death
    // rather than as a timeout thirty seconds later.
    if (exited !== null) {
      return { ready: false, exitCode: exited, output, stop, url: null }
    }
    if (await portInUse(port)) {
      const host = (await probe(port, '127.0.0.1')) ? '127.0.0.1' : '[::1]'
      return { ready: true, exitCode: null, output, stop, url: `http://${host}:${port}` }
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  await stop()
  return { ready: false, exitCode: exited, output, stop, url: null, timedOut: true }
}

/** Wait for whatever is on `port` to go away, so the next server can bind it. */
export async function waitForPortFree(port = 5173, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!(await portInUse(port))) return true
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}
