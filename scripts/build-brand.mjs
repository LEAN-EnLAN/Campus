#!/usr/bin/env node
/**
 * Brand SVGs -> every raster the web app, the PWA manifest and the desktop shell need.
 *
 *   node scripts/build-brand.mjs
 *
 * Sources (hand-built, approved geometry — edit these, never the outputs):
 *   public/brand/campus-mark.svg   navy C arc + blue dot, transparent
 *   public/brand/favicon.svg       white C + light-blue dot on a navy rounded square
 *
 * Outputs:
 *   public/favicon.svg                 copy of the favicon source
 *   public/favicon.ico                 16/32/48, PNG-encoded entries
 *   public/apple-touch-icon.png        180, full-bleed navy (iOS rounds it itself)
 *   public/icon-192.png, icon-512.png  the favicon as drawn (purpose "any")
 *   public/icon-maskable-512.png       full-bleed navy, mark at 70% (purpose "maskable")
 *   docs/brand/campus-mark-1024.png    masters, and the input of `tauri icon`
 *   docs/brand/favicon-1024.png
 */
import { copyFileSync, readFileSync, statSync, writeFileSync } from 'node:fs'

import sharp from 'sharp'

const MARK = 'public/brand/campus-mark.svg'
const FAVICON = 'public/brand/favicon.svg'

const favicon = readFileSync(FAVICON, 'utf8')
// The mark group of the favicon, re-framed on a square with no corner radius:
// launchers and iOS apply their own mask, and transparent corners turn black there.
const markGroup = favicon.match(/<g[\s\S]*<\/g>/)?.[0]
if (!markGroup) throw new Error(`${FAVICON}: no <g> mark group`)
const fullBleed = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#10224a"/>${markGroup.replace(/scale\([\d.]+\)/, `scale(${scale})`)}</svg>`

async function png(svg, size, dest) {
  const buf = typeof svg === 'string' ? Buffer.from(svg) : svg
  await sharp(buf, { density: (72 * size) / 64 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(dest)
  console.log(`${dest.padEnd(36)} ${String(size).padStart(5)}px ${kb(dest)}`)
}

async function pngBuffer(svg, size) {
  return sharp(Buffer.from(svg), { density: (72 * size) / 64 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/** ICO container with PNG-encoded images (supported by every browser and Windows Vista+). */
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)
  const dir = Buffer.alloc(16 * images.length)
  let offset = header.length + dir.length
  images.forEach(({ size, data }, i) => {
    const at = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, at) // width
    dir.writeUInt8(size >= 256 ? 0 : size, at + 1) // height
    dir.writeUInt8(0, at + 2) // palette
    dir.writeUInt8(0, at + 3) // reserved
    dir.writeUInt16LE(1, at + 4) // colour planes
    dir.writeUInt16LE(32, at + 6) // bits per pixel
    dir.writeUInt32LE(data.length, at + 8)
    dir.writeUInt32LE(offset, at + 12)
    offset += data.length
  })
  return Buffer.concat([header, dir, ...images.map((i) => i.data)])
}

const kb = (file) => `${(statSync(file).size / 1024).toFixed(1).padStart(7)} KB`

copyFileSync(FAVICON, 'public/favicon.svg')

const sizes = [16, 32, 48]
const entries = await Promise.all(
  sizes.map(async (size) => ({ size, data: await pngBuffer(favicon, size) })),
)
writeFileSync('public/favicon.ico', ico(entries))
console.log(
  `${'public/favicon.ico'.padEnd(36)} ${sizes.join('/').padStart(8)} ${kb('public/favicon.ico')}`,
)

await png(fullBleed(0.78), 180, 'public/apple-touch-icon.png')
await png(favicon, 192, 'public/icon-192.png')
await png(favicon, 512, 'public/icon-512.png')
await png(fullBleed(0.7), 512, 'public/icon-maskable-512.png')
await png(readFileSync(MARK), 1024, 'docs/brand/campus-mark-1024.png')
await png(favicon, 1024, 'docs/brand/favicon-1024.png')
