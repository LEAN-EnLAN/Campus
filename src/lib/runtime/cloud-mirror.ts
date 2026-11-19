import type { AcademicItem, StoredSubjectStatus } from '@/domain/types'
import { buildExport, type CampusExport } from '@/features/settings/export-data'
import type { CampusBackend } from '@/lib/backends/types'
import { VaultConflictError } from '@/lib/vault/errors'
import type { VaultAccess } from '@/lib/vault/vault-access'

/**
 * The per-device local copy of a CLOUD workspace: one way, cloud → folder.
 *
 * The folder gets readable files (the same JSON as "Descargar mis datos", plus
 * Markdown a person can open in any editor). Nothing is read back: an edit in
 * the folder is overwritten by the next copy, and the folder's LEEME.md says
 * so. Two-way sync is a different problem (see campus-local-first, conflict
 * semantics) and deliberately not attempted here.
 */

export const MIRROR_FILES = {
  readme: 'LEEME.md',
  data: 'campus-datos.json',
  subjects: 'Materias.md',
  dates: 'Fechas.md',
} as const

export interface MirrorFile {
  path: string
  contents: string
}

const STATUS_LABEL: Record<StoredSubjectStatus, string> = {
  in_progress: 'Cursando',
  regularized: 'Regularizada',
  passed: 'Aprobada',
  failed: 'Desaprobada',
  equivalent: 'Por equivalencia',
}

const KIND_LABEL: Record<AcademicItem['kind'], string> = {
  task: 'Tarea',
  assignment: 'Entrega',
  midterm: 'Parcial',
  final: 'Final',
  registration: 'Inscripción',
  class: 'Clase',
  custom: 'Otro',
}

/** Everything the copy is made of, read from the backend in one go. */
export interface MirrorSnapshot {
  data: CampusExport
  /** Subject id → name, from the plan and the student's own subjects. */
  subjectNames: Map<string, string>
}

export async function readMirrorSnapshot(
  backend: CampusBackend,
  email: string | null,
  now: Date,
): Promise<MirrorSnapshot> {
  const [academicContext, subjectStates, manualSubjects, items, resources] = await Promise.all([
    backend.academic.context(),
    backend.academic.subjectStates(),
    backend.academic.manualSubjects(),
    backend.items.list(),
    backend.resources.list(),
  ])
  const subjectNames = new Map<string, string>()
  if (academicContext?.curriculumId) {
    const bundle = await backend.catalog.curriculumBundle(academicContext.curriculumId)
    for (const subject of bundle.subjects) subjectNames.set(subject.id, subject.name)
  }
  for (const subject of manualSubjects) subjectNames.set(subject.id, subject.name)
  const data = buildExport(
    {
      profile: { workspace: 'cloud', email },
      academicContext,
      subjectStates,
      manualSubjects,
      items,
      resources,
    },
    now,
  )
  return { data, subjectNames }
}

const pad = (n: number) => String(n).padStart(2, '0')

function stamp(iso: string): string {
  const d = new Date(iso)
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The files of one copy. Pure: same snapshot, same files. */
export function mirrorFiles({ data, subjectNames }: MirrorSnapshot): MirrorFile[] {
  const name = (id: string | null) => (id ? (subjectNames.get(id) ?? id) : null)

  const readme = [
    '# Copia de Campus',
    '',
    `Copia de tu espacio en la nube, hecha el ${stamp(data.exportedAt)}.`,
    '',
    'Campus actualiza estos archivos solo, desde la nube hacia esta carpeta.',
    '**Lo que cambies acá no se sube a la nube** (todavía): la próxima copia lo reemplaza.',
    '',
    `- ${MIRROR_FILES.subjects}: tus materias y cómo vas.`,
    `- ${MIRROR_FILES.dates}: entregas, parciales y finales.`,
    `- ${MIRROR_FILES.data}: todo, en JSON (el mismo formato que "Descargar mis datos").`,
    '',
  ].join('\n')

  const states = [...data.subjectStates].sort((a, b) =>
    (name(a.curriculumSubjectId) ?? '').localeCompare(name(b.curriculumSubjectId) ?? '', 'es'),
  )
  const subjects = [
    '# Materias',
    '',
    ...(states.length === 0
      ? ['Todavía no marcaste ninguna materia.']
      : states.map(
          (s) =>
            `- ${name(s.curriculumSubjectId)}: ${STATUS_LABEL[s.status]}` +
            (s.grade !== null ? ` (nota ${s.grade})` : ''),
        )),
    '',
  ].join('\n')

  const items = [...data.items].sort((a, b) =>
    (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'),
  )
  const dates = [
    '# Fechas',
    '',
    ...(items.length === 0
      ? ['No hay fechas cargadas.']
      : items.map((item) => {
          const done = item.status === 'done' ? 'x' : ' '
          const when = item.dueAt ? `${stamp(item.dueAt)} · ` : ''
          const subject = name(item.curriculumSubjectId)
          return (
            `- [${done}] ${when}${KIND_LABEL[item.kind]}: ${item.title}` +
            (subject ? ` (${subject})` : '')
          )
        })),
    '',
  ].join('\n')

  return [
    { path: MIRROR_FILES.readme, contents: readme },
    { path: MIRROR_FILES.subjects, contents: subjects },
    { path: MIRROR_FILES.dates, contents: dates },
    { path: MIRROR_FILES.data, contents: JSON.stringify(data, null, 2) + '\n' },
  ]
}

/**
 * Write one copy into the folder. Each file is replaced as a whole; a file the
 * student changed in between is overwritten too, which is the one-way promise
 * LEEME.md states. A write that loses a race is retried once on a fresh mtime.
 * A file whose contents did not change is left alone.
 */
export async function writeMirror(access: VaultAccess, files: MirrorFile[]): Promise<number> {
  let written = 0
  for (const file of files) {
    const current = await access.stat(file.path)
    if (current) {
      const existing = await access.readNote(file.path)
      if (existing.contents === file.contents) continue
    }
    try {
      await access.writeNote(file.path, file.contents, current?.mtimeMs ?? null)
    } catch (cause) {
      if (!(cause instanceof VaultConflictError)) throw cause
      const fresh = await access.stat(file.path)
      await access.writeNote(file.path, file.contents, fresh?.mtimeMs ?? null)
    }
    written += 1
  }
  return written
}
