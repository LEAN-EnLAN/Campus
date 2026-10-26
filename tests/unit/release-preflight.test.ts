import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

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
  return repo
}

function preflight(repo: string, tag = 'v0.1.0') {
  const result = spawnSync('node', [script, '--tag', tag], { cwd: repo, encoding: 'utf8' })
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
    expect(result.output).toContain('metadata and Git state OK')
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
})
