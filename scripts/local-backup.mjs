#!/usr/bin/env node
/**
 * Offline backup/verify/restore for a LOCAL Campus folder. No Cloud credentials,
 * database claims, or release side effects. Does not follow Windows junctions,
 * POSIX symlinks or other special files.
 *
 * Usage: node scripts/local-backup.mjs backup <vault> <new-backup-directory>
 *        node scripts/local-backup.mjs verify <backup-directory>
 *        node scripts/local-backup.mjs restore <backup-directory> <new-vault-directory>
 */
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const FORMAT = 'campus-local-backup-v1'
const MANIFEST = 'manifest.json'
const DATA = 'data'

const fail = (message) => {
  throw new Error(message)
}

async function statOrNull(path) {
  try {
    return await lstat(path)
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
}

function isNested(parent, candidate) {
  const rel = relative(parent, candidate)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

function safePart(part) {
  return (
    part.length > 0 &&
    part !== '.' &&
    part !== '..' &&
    !/[<>:"\\|?*\u0000-\u001f]/u.test(part) &&
    !/[. ]$/u.test(part) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part)
  )
}

function safeRelative(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.split('/').every(safePart) &&
    !name.includes('\\')
  )
}

async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function enumerate(root) {
  const out = []
  async function walk(path, prefix) {
    const files = (await readdir(path)).sort()
    for (const name of files) {
      const rel = prefix ? `${prefix}/${name}` : name
      if (!safeRelative(rel)) fail(`unsafe or non-portable path in backup: ${rel}`)
      const absolute = join(path, name)
      const stat = await lstat(absolute)
      if (stat.isSymbolicLink()) fail(`symlink/junction is not backed up: ${rel}`)
      if (stat.isDirectory()) {
        out.push({ path: rel, type: 'directory' })
        await walk(absolute, rel)
      } else if (stat.isFile()) {
        out.push({ path: rel, type: 'file', size: stat.size, sha256: await hashFile(absolute) })
      } else fail(`special filesystem entry is not backed up: ${rel}`)
    }
  }
  await walk(root, '')
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

async function replicate(source, dest, entries) {
  for (const entry of entries) {
    const dst = join(dest, ...entry.path.split('/'))
    if (entry.type === 'directory') await mkdir(dst, { recursive: true })
    else {
      await mkdir(dirname(dst), { recursive: true })
      await copyFile(join(source, ...entry.path.split('/')), dst)
    }
  }
}

async function mustBeDirectory(path, label) {
  const stat = await lstat(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`${label} must be a real directory`)
  return await realpath(path)
}

async function newDestination(dest, source) {
  if (!isAbsolute(dest)) fail('destination must be absolute')
  const target = resolve(dest)
  const parent = await mustBeDirectory(dirname(target), 'destination parent')
  if (await statOrNull(target)) fail('destination must not exist (no overwrites)')
  const finalPath = join(parent, basename(target))
  if (isNested(source, finalPath) || isNested(finalPath, source)) {
    fail('source and destination cannot overlap')
  }
  return { parent, target: finalPath }
}

async function stageInto(target, makeContents) {
  const stage = await mkdtemp(join(dirname(target), '.campus-backup-stage-'))
  try {
    await makeContents(stage)
    if (await statOrNull(target)) fail('destination must not exist (no overwrites)')
    await rename(stage, target)
  } finally {
    await rm(stage, { force: true, recursive: true })
  }
}

export async function backupLocal(vault, destination) {
  if (!isAbsolute(vault)) fail('vault path must be absolute')
  const source = await mustBeDirectory(resolve(vault), 'vault')
  const { target } = await newDestination(destination, source)
  await stageInto(target, async (stage) => {
    await mkdir(join(stage, DATA))
    const entries = await enumerate(source)
    await replicate(source, join(stage, DATA), entries)
    const copied = await enumerate(join(stage, DATA))
    if (JSON.stringify(entries) !== JSON.stringify(copied))
      fail('vault changed while copying; stop Campus and retry')
    await writeFile(
      join(stage, MANIFEST),
      JSON.stringify({ format: FORMAT, entries }, null, 2) + '\n',
      { mode: 0o600 },
    )
  })
  return { directory: target }
}

export async function verifyLocal(backup) {
  if (!isAbsolute(backup)) fail('backup path must be absolute')
  const source = await mustBeDirectory(resolve(backup), 'backup')
  const children = (await readdir(source)).sort()
  if (JSON.stringify(children) !== JSON.stringify([DATA, MANIFEST].sort()))
    fail('unexpected backup root entries')
  await mustBeDirectory(join(source, DATA), 'backup data')
  const manifestStat = await lstat(join(source, MANIFEST))
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink())
    fail('backup manifest must be a regular file')
  const manifest = JSON.parse(await readFile(join(source, MANIFEST), 'utf8'))
  if (manifest?.format !== FORMAT || !Array.isArray(manifest.entries))
    fail('unknown backup format')
  for (const entry of manifest.entries) {
    if (!entry || !safeRelative(entry.path) || !['file', 'directory'].includes(entry.type))
      fail('unsafe manifest entry')
  }
  const observed = await enumerate(join(source, DATA))
  if (JSON.stringify(manifest.entries) !== JSON.stringify(observed))
    fail('backup integrity mismatch')
  return {
    directory: source,
    entries: observed,
    files: observed.filter((e) => e.type === 'file').length,
  }
}

export async function restoreLocal(backup, destination) {
  const checked = await verifyLocal(backup)
  const { target } = await newDestination(destination, checked.directory)
  await stageInto(target, async (stage) => {
    await replicate(join(checked.directory, DATA), stage, checked.entries)
    const restored = await enumerate(stage)
    if (JSON.stringify(restored) !== JSON.stringify(checked.entries))
      fail('restored data differs from backup')
  })
  return { directory: target, files: checked.files }
}

async function main() {
  const [operation, input, output, ...extra] = process.argv.slice(2)
  if (
    extra.length ||
    !['backup', 'verify', 'restore'].includes(operation) ||
    !input ||
    (operation !== 'verify' && !output) ||
    (operation === 'verify' && output)
  ) {
    fail(
      'usage: local-backup.mjs backup <vault> <new-dir> | verify <backup-dir> | restore <backup-dir> <new-vault-dir>',
    )
  }
  const result =
    operation === 'backup'
      ? await backupLocal(input, output)
      : operation === 'verify'
        ? await verifyLocal(input)
        : await restoreLocal(input, output)
  console.log(`${operation.toUpperCase()} OK: ${result.directory}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(`BLOCK: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  })
}
