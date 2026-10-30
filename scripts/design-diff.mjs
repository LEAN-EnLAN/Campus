#!/usr/bin/env node
/**
 * Pixel-diff two screenshot folders produced by scripts/design-shots.mjs.
 *   node scripts/design-diff.mjs <before-dir> <after-dir> [--max=0.5]
 * Prints % of changed pixels per screen, writes diff PNGs to <after-dir>/_diff,
 * exits 1 when any screen exceeds --max percent. Decoding runs inside Chromium
 * (canvas), so there are no extra dependencies.
 */
import { chromium } from '@playwright/test'
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from 'node:fs'
import { join } from 'node:path'

const [before, after] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const max = Number((process.argv.find((a) => a.startsWith('--max=')) ?? '--max=0.5').slice(6))
if (!before || !after)
  throw new Error('usage: design-diff.mjs <before> <after> [--max=percent]')

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch())
const page = await browser.newPage()
let worst = 0
const rows = []

for (const size of readdirSync(after).filter(
  (d) => !d.startsWith('_') && statSync(join(after, d)).isDirectory(),
)) {
  for (const file of readdirSync(join(after, size)).filter((f) => f.endsWith('.png'))) {
    const a = join(after, size, file)
    const b = join(before, size, file)
    if (!existsSync(b)) {
      rows.push([size, file, 'missing before'])
      continue
    }
    const result = await page.evaluate(
      async ([x, y]) => {
        const load = (src) =>
          new Promise((res) => {
            const img = new Image()
            img.onload = () => res(img)
            img.src = src
          })
        const [ia, ib] = await Promise.all([load(x), load(y)])
        if (ia.width !== ib.width || ia.height !== ib.height)
          return { size: `${ib.width}x${ib.height} -> ${ia.width}x${ia.height}` }
        const c = (img) => {
          const cv = document.createElement('canvas')
          cv.width = img.width
          cv.height = img.height
          const ctx = cv.getContext('2d')
          ctx.drawImage(img, 0, 0)
          return ctx.getImageData(0, 0, img.width, img.height)
        }
        const da = c(ia)
        const db = c(ib)
        const out = new ImageData(da.width, da.height)
        let changed = 0
        const W = da.width
        const H = da.height
        const px = (d, x, y) => (y * W + x) * 4
        const near = (x, y) => {
          // Smallest difference against the 3x3 neighbourhood in the other image:
          // sub-pixel text and edge anti-aliasing passes, a moved element does not.
          let best = 999
          const i = px(da, x, y)
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx
              const yy = y + dy
              if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
              const j = px(db, xx, yy)
              const d =
                Math.abs(da.data[i] - db.data[j]) +
                Math.abs(da.data[i + 1] - db.data[j + 1]) +
                Math.abs(da.data[i + 2] - db.data[j + 2])
              if (d < best) best = d
            }
          return best
        }
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const i = px(da, x, y)
            if (near(x, y) > 24) {
              changed++
              out.data.set([255, 0, 80, 255], i)
            } else out.data.set([da.data[i], da.data[i + 1], da.data[i + 2], 70], i)
          }
        const cv = document.createElement('canvas')
        cv.width = da.width
        cv.height = da.height
        cv.getContext('2d').putImageData(out, 0, 0)
        // Structural: compare 4x4 block averages. Glyph anti-aliasing averages out,
        // a moved or resized element does not.
        let structural = 0
        const B = 4
        for (let by = 0; by + B <= H; by += B)
          for (let bx = 0; bx + B <= W; bx += B) {
            let d = 0
            for (let ch = 0; ch < 3; ch++) {
              let sa = 0
              let sb = 0
              for (let y = 0; y < B; y++)
                for (let x = 0; x < B; x++) {
                  const i = px(da, bx + x, by + y) + ch
                  sa += da.data[i]
                  sb += db.data[i]
                }
              d += Math.abs(sa - sb) / (B * B)
            }
            if (d > 24) structural++
          }
        return {
          pct: (changed / (W * H)) * 100,
          structural: (structural / ((W / B) * (H / B))) * 100,
          png: cv.toDataURL('image/png'),
        }
      },
      [
        'data:image/png;base64,' + readFileSync(a).toString('base64'),
        'data:image/png;base64,' + readFileSync(b).toString('base64'),
      ],
    )
    if (result.size) {
      rows.push([size, file, 'SIZE ' + result.size])
      worst = Infinity
      continue
    }
    worst = Math.max(worst, result.structural)
    rows.push([
      size,
      file,
      `structural ${result.structural.toFixed(3)}%  edge ${result.pct.toFixed(3)}%`,
    ])
    if (result.pct > 0) {
      mkdirSync(join(after, '_diff', size), { recursive: true })
      writeFileSync(
        join(after, '_diff', size, file),
        Buffer.from(result.png.split(',')[1], 'base64'),
      )
    }
  }
}
await browser.close()
for (const [s, f, r] of rows) console.log(`${s.padEnd(9)} ${f.padEnd(40)} ${r}`)
console.log(
  `worst: ${worst === Infinity ? 'size mismatch' : worst.toFixed(3) + '%'} (limit ${max}%)`,
)
process.exitCode = worst > max ? 1 : 0
