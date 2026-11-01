import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const script = resolve(process.cwd(), 'scripts/release-preflight.mjs')
const roots: string[] = []

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()
}

function candidate(options: { version?: string; license?: boolean; changelog?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'campus-release-test-'))
  roots.push(root)
  const repo = join(root, 'repo')
  const remote = join(root, 'remote.git')
  git(root, 'init', '--quiet', '--bare', remote)
  git(root, 'init', '--quiet', '--initial-branch=main', repo)
  git(repo, 'config', 'user.name', 'Campus test')
  git(repo, 'config', 'user.email', 'campus-test@example.invalid')
  git(repo, 'remote', 'add', 'origin', remote)
  writeFileSync(
    join(repo, 'package.json'),
    JSON.stringify({ version: options.version ?? '0.1.0' }),
  )
  if (options.license !== false) writeFileSync(join(repo, 'LICENSE'), 'Test fixture license')
  if (options.changelog !== false)
    writeFileSync(join(repo, 'CHANGELOG.md'), '## [0.1.0]\n\n- Test fixture\n')
  git(repo, 'add', '.')
  git(repo, 'commit', '--quiet', '-m', 'init release fixture')
  git(repo, 'push', '--quiet', '-u', 'origin', 'main')
  // Synthetic operational attestations, solely in a temporary TEST fixture.
  // They do not belong to Campus or demonstrate SMTP/Cloud E2E checks.
  const checked = {
    result: 'pass',
    testedAt: new Date().toISOString(),
    verifiedBy: 'Fixture Operator',
    environment: 'isolated test fixture',
    evidenceRef: 'https://example.invalid/test/evidence',
  }
  writeFileSync(
    join(root, 'operational-evidence.json'),
    JSON.stringify({
      schema: 1,
      releaseTag: 'v0.1.0',
      commit: git(repo, 'rev-parse', 'HEAD'),
      checks: { smtpPasswordReset: checked, cloudRestore: checked },
    }),
  )
  return repo
}

function preflight(
  repo: string,
  tag = 'v0.1.0',
  evidence = join(dirname(repo), 'operational-evidence.json'),
) {
  const result = spawnSync('node', [script, '--tag', tag, '--evidence', evidence], {
    cwd: repo,
    encoding: 'utf8',
  })
  return { status: result.status, output: result.stdout + result.stderr }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('release:check — real read-only Git preflight', () => {
  it('accepts clean main, matching changelog/license and unused tag', () => {
    const repo = candidate()
    const result = preflight(repo)
    expect(result.status).toBe(0)
    expect(result.output).toContain('evidence record checks OK')
    expect(result.output).toContain('NOT independently verified')
    expect(git(repo, 'tag', '--list')).toBe('')
  }, 30000)

  it('rejects missing mandatory license and changelog', () => {
    const result = preflight(candidate({ license: false, changelog: false }))
    expect(result.status).toBe(1)
    expect(result.output).toContain('LICENSE is missing')
    expect(result.output).toContain('CHANGELOG.md is missing')
  }, 30000)

  it('rejects mismatched package version and malformed prerelease', () => {
    const repo = candidate({ version: '0.2.0' })
    expect(preflight(repo).output).toContain('does not match package.json')
    expect(preflight(repo, 'v0.1.0-rc..1').output).toContain('must be a version')
  }, 30000)

  it('rejects dirty tree, divergent local HEAD, duplicate tags and wrong branch', () => {
    const repo = candidate()
    writeFileSync(join(repo, 'untracked.txt'), 'not committed')
    expect(preflight(repo).output).toContain('working tree is not clean')
    git(repo, 'add', '.')
    git(repo, 'commit', '--quiet', '-m', 'local-only change')
    expect(preflight(repo).output).toContain('HEAD differs from origin/main')
    git(repo, 'push', '--quiet')
    git(repo, 'tag', 'v0.1.0')
    git(repo, 'push', '--quiet', 'origin', 'v0.1.0')
    const result = preflight(repo)
    expect(result.output).toContain('already exists locally')
    expect(result.output).toContain('already exists on the remote')
    git(repo, 'switch', '--quiet', '-c', 'feature')
    expect(preflight(repo).output).toContain('expected main')
  }, 30000)

  it('blocks when evidence is missing or SMTP/Cloud checks are not both attested', () => {
    const repo = candidate()
    const file = join(dirname(repo), 'operational-evidence.json')
    expect(preflight(repo, 'v0.1.0', join(dirname(repo), 'missing.json')).output).toContain(
      'operational evidence file is missing',
    )
    const record = JSON.parse(readFileSync(file, 'utf8'))
    record.checks.smtpPasswordReset.result = 'pending'
    delete record.checks.cloudRestore
    writeFileSync(file, JSON.stringify(record))
    const output = preflight(repo).output
    expect(output).toContain('real SMTP password-reset receipt')
    expect(output).toContain('isolated Cloud/Postgres dump and restore')
  }, 30000)

  it('rejects stale, mismatched and insufficient operational records', () => {
    const repo = candidate()
    const file = join(dirname(repo), 'operational-evidence.json')
    const record = JSON.parse(readFileSync(file, 'utf8'))
    record.commit = '0'.repeat(40)
    record.checks.smtpPasswordReset.testedAt = '2020-01-01T00:00:00.000Z'
    record.checks.cloudRestore.evidenceRef = 'not-a-link'
    writeFileSync(file, JSON.stringify(record))
    const output = preflight(repo).output
    expect(output).toContain('exact HEAD SHA')
    expect(output).toContain('recent, exact ISO UTC timestamp')
    expect(output).toContain('inspectable HTTPS evidence URL')
  }, 30000)
})
