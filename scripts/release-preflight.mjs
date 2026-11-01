#!/usr/bin/env node
/**
 * Read-only gate before a maintainer manually creates a GitHub Release.
 * Never creates tags, changes branches, deploys or publishes anything.
 * See docs/RELEASING.md for the independent CI and product gates.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const semver =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

export function inspectReleaseFiles(root, tag) {
  const failures = []
  if (!semver.test(tag)) {
    failures.push(`tag "${tag}" must be a version like v0.1.0 or v0.1.0-rc.1`)
    return failures
  }

  const packageFile = resolve(root, 'package.json')
  if (!existsSync(packageFile)) return ['package.json is missing']
  let pkg
  try {
    pkg = JSON.parse(readFileSync(packageFile, 'utf8'))
  } catch {
    return ['package.json is not valid JSON']
  }
  if (tag !== `v${pkg.version}`) {
    failures.push(`tag ${tag} does not match package.json version ${pkg.version}`)
  }

  if (
    !['LICENSE', 'LICENSE.md', 'LICENSE.txt'].some((name) => existsSync(resolve(root, name)))
  ) {
    failures.push('LICENSE is missing: the project owner must select and add a license')
  }

  const changelogFile = resolve(root, 'CHANGELOG.md')
  if (!existsSync(changelogFile)) {
    failures.push('CHANGELOG.md is missing')
  } else {
    const heading = `## [${tag.slice(1)}]`
    if (
      !readFileSync(changelogFile, 'utf8')
        .split(/\r?\n/)
        .some((line) => line.trim() === heading)
    ) {
      failures.push(`CHANGELOG.md has no section for ${tag}`)
    }
  }
  return failures
}

function git(root, ...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
  }).trim()
}

export function inspectReleaseGit(root, tag, runGit = git) {
  const failures = []
  try {
    const branch = runGit(root, 'branch', '--show-current')
    if (branch !== 'main')
      failures.push(`current branch is ${branch || '(detached)'}, expected main`)
    if (runGit(root, 'status', '--porcelain', '--untracked-files=normal')) {
      failures.push('working tree is not clean')
    }
    const head = runGit(root, 'rev-parse', 'HEAD')
    const remoteMain = runGit(root, 'ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0]
    if (!remoteMain || head !== remoteMain) {
      failures.push('HEAD differs from origin/main on GitHub (fetch/review before releasing)')
    }
    if (runGit(root, 'tag', '--list', tag)) failures.push(`${tag} already exists locally`)
    if (runGit(root, 'ls-remote', '--tags', 'origin', `refs/tags/${tag}`)) {
      failures.push(`${tag} already exists on the remote`)
    }
  } catch (error) {
    failures.push(
      `cannot verify GitHub/git state: ${error instanceof Error ? error.message : error}`,
    )
  }
  return failures
}

/**
 * These are human-supplied, commit-bound operational attestations, NOT proof
 * that this script delivered email or connected to a production database.
 * Keep the record outside the repo so release evidence does not leak test data.
 */
export function inspectOperationalEvidence(root, path, tag, head, now = Date.now()) {
  if (!path) return ['operational evidence missing: pass --evidence <private-json-path>']
  let record
  try {
    record = JSON.parse(readFileSync(resolve(root, path), 'utf8'))
  } catch {
    return ['operational evidence file is missing or invalid JSON']
  }
  const failures = []
  if (record?.schema !== 1 || record.releaseTag !== tag || record.commit !== head) {
    failures.push('operational evidence must match schema 1, this tag and exact HEAD SHA')
  }
  for (const [key, description] of [
    ['smtpPasswordReset', 'real SMTP password-reset receipt and sign-in'],
    ['cloudRestore', 'isolated Cloud/Postgres dump and restore with RLS checks'],
  ]) {
    const check = record?.checks?.[key]
    if (!check || check.result !== 'pass') {
      failures.push(`${description}: signed-off evidence not present (result=pass required)`)
      continue
    }
    const when = Date.parse(check.testedAt)
    if (
      typeof check.testedAt !== 'string' ||
      !Number.isFinite(when) ||
      new Date(when).toISOString() !== check.testedAt ||
      when > now ||
      now - when > 30 * 24 * 60 * 60 * 1000
    ) {
      failures.push(`${description}: testedAt must be a recent, exact ISO UTC timestamp`)
    }
    if (
      typeof check.verifiedBy !== 'string' ||
      check.verifiedBy.trim().length < 2 ||
      typeof check.environment !== 'string' ||
      check.environment.trim().length < 3 ||
      typeof check.evidenceRef !== 'string' ||
      !/^https:\/\/[^\s/]+\/\S+$/i.test(check.evidenceRef)
    ) {
      failures.push(
        `${description}: verifier, environment and inspectable HTTPS evidence URL required`,
      )
    }
  }
  return failures
}

async function main() {
  const { values } = parseArgs({
    options: { tag: { type: 'string' }, evidence: { type: 'string' } },
  })
  if (!values.tag) {
    console.error('Usage: pnpm release:check --tag v0.1.0 --evidence <private-json-path>')
    process.exitCode = 1
    return
  }
  const root = process.cwd()
  let head = ''
  try {
    head = git(root, 'rev-parse', 'HEAD')
  } catch {
    // inspectReleaseGit reports the underlying Git failure separately.
  }
  const failures = [
    ...inspectReleaseFiles(root, values.tag),
    ...inspectReleaseGit(root, values.tag),
    ...inspectOperationalEvidence(root, values.evidence, values.tag, head),
  ]
  if (failures.length) {
    failures.forEach((failure) => console.error(`BLOCK  ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`release-preflight ${values.tag}: metadata, Git and evidence record checks OK`)
  console.log(
    'Human evidence attestations are NOT independently verified by this CLI. Still required: GitHub CI on this SHA, evidence inspection, release notes and approval.',
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
