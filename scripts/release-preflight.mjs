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

async function main() {
  const { values } = parseArgs({ options: { tag: { type: 'string' } } })
  if (!values.tag) {
    console.error('Usage: pnpm release:check --tag v0.1.0')
    process.exitCode = 1
    return
  }
  const root = process.cwd()
  const failures = [
    ...inspectReleaseFiles(root, values.tag),
    ...inspectReleaseGit(root, values.tag),
  ]
  if (failures.length) {
    failures.forEach((failure) => console.error(`BLOCK  ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`release-preflight ${values.tag}: local metadata and Git state OK`)
  console.log(
    'Still required: GitHub CI green, release notes review, backup checks and approval.',
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
