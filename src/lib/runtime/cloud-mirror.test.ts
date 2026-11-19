import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadPortableCatalog } from '@/lib/backends/local/catalog'
import { LocalBackend } from '@/lib/backends/local/local-backend'
import { nodeCatalogReader } from '@/lib/backends/local/node-catalog'
import { seedDemo } from '@/lib/demo/seed'
import { memoryVaultAccess } from '@/lib/vault/memory-vault-access'

import { MIRROR_FILES, mirrorFiles, readMirrorSnapshot, writeMirror } from './cloud-mirror'

const NOW = new Date(2026, 10, 19, 10, 0)

/** Any backend will do as "the cloud": the seeded demo is a full one. */
async function seededBackend() {
  const catalog = await loadPortableCatalog(
    join(process.cwd(), 'public/academic-catalog'),
    nodeCatalogReader,
  )
  const backend = new LocalBackend(memoryVaultAccess(), catalog)
  await seedDemo(backend, NOW)
  return backend
}

describe('the local copy of a cloud workspace', () => {
  it('writes readable Markdown and the export JSON into the folder', async () => {
    const backend = await seededBackend()
    const folder = memoryVaultAccess()

    const snapshot = await readMirrorSnapshot(backend, 'estudiante@example.com', NOW)
    await writeMirror(folder, mirrorFiles(snapshot))

    const files = folder.files()
    expect([...files.keys()].sort()).toEqual(
      [
        MIRROR_FILES.data,
        MIRROR_FILES.dates,
        MIRROR_FILES.readme,
        MIRROR_FILES.subjects,
      ].sort(),
    )
    expect(files.get(MIRROR_FILES.readme)).toMatch(/no se sube a la nube/)
    expect(files.get(MIRROR_FILES.subjects)).toMatch(/- Paradigmas de Programación: Cursando/)
    expect(files.get(MIRROR_FILES.dates)).toMatch(
      /Parcial: Parcial de planificación de procesos \(Sistemas Operativos\)/,
    )
    expect(files.get(MIRROR_FILES.dates)).toMatch(/- \[x\] .*Entrega TP 1/)

    const data = JSON.parse(files.get(MIRROR_FILES.data)!) as {
      format: string
      profile: unknown
      items: unknown[]
    }
    expect(data.format).toBe('campus-export')
    expect(data.profile).toEqual({ workspace: 'cloud', email: 'estudiante@example.com' })
    expect(data.items.length).toBeGreaterThan(5)
  })

  it('is one-way: the next copy replaces an edit made in the folder', async () => {
    const backend = await seededBackend()
    const folder = memoryVaultAccess()
    const files = mirrorFiles(await readMirrorSnapshot(backend, null, NOW))
    await writeMirror(folder, files)

    const edited = await folder.readNote(MIRROR_FILES.subjects)
    await folder.writeNote(MIRROR_FILES.subjects, 'lo cambié a mano', edited.mtimeMs)

    await writeMirror(folder, files)
    expect(folder.files().get(MIRROR_FILES.subjects)).toMatch(/^# Materias/)
  })

  it('leaves files whose contents did not change alone', async () => {
    const backend = await seededBackend()
    const folder = memoryVaultAccess()
    const files = mirrorFiles(await readMirrorSnapshot(backend, null, NOW))

    expect(await writeMirror(folder, files)).toBe(4)
    expect(await writeMirror(folder, files)).toBe(0)
  })

  it('follows a change in the cloud on the next copy', async () => {
    const backend = await seededBackend()
    const folder = memoryVaultAccess()
    await writeMirror(folder, mirrorFiles(await readMirrorSnapshot(backend, null, NOW)))

    await backend.items.create({
      title: 'Coloquio de Sintaxis',
      kind: 'final',
      curriculumSubjectId: 'sintaxis-y-semantica-de-los-lenguajes-13',
      dueAt: new Date(2026, 11, 2, 9).toISOString(),
    })
    await writeMirror(folder, mirrorFiles(await readMirrorSnapshot(backend, null, NOW)))

    expect(folder.files().get(MIRROR_FILES.dates)).toMatch(
      /Final: Coloquio de Sintaxis \(Sintaxis y Semántica de los Lenguajes\)/,
    )
  })
})
