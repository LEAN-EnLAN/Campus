#!/usr/bin/env node
/**
 * PNG masters -> optimized WebP for public/campus-blue-assets.
 *
 *   node scripts/optimize-assets.mjs <dir-with-pngs> [--only=name,name] [--out=public/campus-blue-assets]
 *
 * Masters are RGBA PNGs at 2x (1280x800 spots, 1920x640 backgrounds). Per master:
 *   spots (< 1920 wide)  <name>.webp at half size + <name>@2x.webp at full size
 *   backgrounds          <name>.webp at 1920 wide, no 2x
 * The file name must be a key of ILLUSTRATIONS (src/components/ui/illustrations.ts),
 * so an image nobody can reference never ships.
 */
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

import sharp from 'sharp'

const args = process.argv.slice(2)
const dir = args.find((a) => !a.startsWith('--'))
const only = args
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',')
const out = args.find((a) => a.startsWith('--out='))?.slice(6) ?? 'public/campus-blue-assets'
if (!dir) throw new Error('usage: optimize-assets.mjs <dir-with-pngs> [--only=a,b] [--out=dir]')

const registry = readFileSync('src/components/ui/illustrations.ts', 'utf8')
const known = new Set([...registry.matchAll(/^ {2}'([a-z0-9-]+)':/gm)].map((m) => m[1]))

const WEBP = { quality: 82, alphaQuality: 92, effort: 6, smartSubsample: true }
mkdirSync(out, { recursive: true })

let rows = 0
let bytes = 0
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith('.png'))
  .sort()) {
  const name = basename(file, '.png')
  if (only && !only.includes(name)) continue
  if (!known.has(name)) {
    console.error(`skip ${file}: "${name}" is not in ILLUSTRATIONS`)
    continue
  }
  const src = join(dir, file)
  const meta = await sharp(src).metadata()
  if (!meta.hasAlpha) console.error(`warn ${file}: no alpha channel (not transparent)`)
  const targets =
    (meta.width ?? 0) >= 1920
      ? [[`${name}.webp`, 1920]]
      : [
          [`${name}.webp`, Math.round((meta.width ?? 0) / 2)],
          [`${name}@2x.webp`, meta.width],
        ]
  for (const [outName, width] of targets) {
    const dest = join(out, outName)
    await sharp(src).resize({ width }).webp(WEBP).toFile(dest)
    const size = statSync(dest).size
    bytes += size
    console.log(
      `${outName.padEnd(36)} ${String(width).padStart(5)}px ${(size / 1024).toFixed(1).padStart(7)} KB`,
    )
  }
  rows++
}
console.log(`\n${rows} masters, ${(bytes / 1024).toFixed(0)} KB total`)
