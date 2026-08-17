/* eslint-disable no-console -- this test EXISTS to print the perf table */
import { performance } from 'node:perf_hooks'

import { describe, it } from 'vitest'

import { VaultIndex } from '@/lib/knowledge/vault-index'

/**
 * Prompt 2 performance measurement, run through vitest so the TS toolchain
 * resolves imports the same way the app does. Not an assertion suite — it
 * PRINTS the table for docs/performance/WORKSPACE_P2.md. The one assertion
 * that matters (backlinks touch only real sources, i.e. no quadratic scan)
 * lives in vault-index.test.ts as a functional test.
 */

const SIZES = [100, 1000, 5000]

function makeNote(i: number, total: number): string {
  const links = [
    `[[Nota ${(i + 1) % total}]]`,
    `[[Nota ${(i + 7) % total}]]`,
    `[[Nota ${(i + 13) % total}]]`,
  ].join(' y ')
  return [
    '---',
    `title: Nota ${i}`,
    'tags:',
    '  - materia-' + (i % 12),
    '---',
    '',
    `# Nota ${i}`,
    '',
    `Contenido de la nota ${i} sobre transformadas, matrices y parciales.`,
    `Ver ${links}.`,
  ].join('\n')
}

describe('workspace index performance', () => {
  it('measures build/search/quick/backlinks at each size', () => {
    console.log('\n| notes | build ms | search ms | quick ms | backlinks ms | upsert ms |')
    console.log('|------:|---------:|----------:|---------:|-------------:|----------:|')
    for (const size of SIZES) {
      const index = new VaultIndex()
      const docs = Array.from({ length: size }, (_, i) => [
        `carpeta-${i % 40}/nota-${i}.md`,
        makeNote(i, size),
      ])
      const t0 = performance.now()
      for (const [path, body] of docs) index.upsert(path!, body!)
      const build = performance.now() - t0
      const t1 = performance.now()
      for (let i = 0; i < 20; i++) index.search('transformadas matrices')
      const search = (performance.now() - t1) / 20
      const t2 = performance.now()
      for (let i = 0; i < 50; i++) index.quickMatch('nota 42', ['carpeta-1/nota-1.md'])
      const quick = (performance.now() - t2) / 50
      const t3 = performance.now()
      for (let i = 0; i < 50; i++) index.backlinks(`carpeta-${i % 40}/nota-${i}.md`)
      const back = (performance.now() - t3) / 50
      const t4 = performance.now()
      index.upsert('carpeta-0/nota-0.md', makeNote(0, size) + '\nx')
      const upsert = performance.now() - t4
      console.log(
        `| ${size} | ${build.toFixed(0)} | ${search.toFixed(2)} | ${quick.toFixed(2)} | ${back.toFixed(3)} | ${upsert.toFixed(2)} |`,
      )
    }
  })
})
