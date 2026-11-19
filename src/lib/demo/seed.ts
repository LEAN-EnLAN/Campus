import type { AcademicItemKind, StoredSubjectStatus } from '@/domain/types'
import type { CampusBackend, CreateResourceInput } from '@/lib/backends/types'

/**
 * The demo student: 2º año of Ingeniería en Sistemas de Información at UTN
 * Facultad Regional Rosario, Plan 2023.
 *
 * Every subject below is an id from `public/academic-catalog/curricula/
 * utn-frro-isi.json` and is looked up in the catalog at seed time — nothing
 * here asserts a subject, a year or a correlativa on its own. The progress is
 * chosen so that it is CONSISTENT with that plan's correlativas: every subject
 * in course has its requirements approved.
 *
 * The deliveries and exams are this imaginary student's own entries, not a
 * faculty calendar: their dates are relative to "now" (so the demo never looks
 * stale) and their notes say they are an example.
 */

export const DEMO_INSTITUTION = 'utn'
export const DEMO_UNIT = 'utn-frro'
export const DEMO_PROGRAM = 'isi'
export const DEMO_CURRICULUM_VERSION = 'Plan 2023'

/** Subject progress, by catalog subject id. */
export const DEMO_PROGRESS: ReadonlyArray<readonly [string, StoredSubjectStatus]> = [
  // 1º año — cerrado, salvo dos finales pendientes.
  ['analisis-matematico-i-1', 'passed'],
  ['algebra-y-geometria-analitica-2', 'passed'],
  ['fisica-i-3', 'regularized'],
  ['ingles-i-4', 'passed'],
  ['logica-y-estructuras-discretas-5', 'passed'],
  ['algoritmos-y-estructuras-de-datos-6', 'passed'],
  ['arquitectura-de-computadoras-7', 'passed'],
  ['sistemas-y-procesos-de-negocio-8', 'passed'],
  // 2º año — lo que está cursando ahora.
  ['ingenieria-y-sociedad-11', 'passed'],
  ['sintaxis-y-semantica-de-los-lenguajes-13', 'regularized'],
  ['analisis-matematico-ii-9', 'in_progress'],
  ['ingles-ii-12', 'in_progress'],
  ['paradigmas-de-programacion-14', 'in_progress'],
  ['sistemas-operativos-15', 'in_progress'],
  ['analisis-de-sistemas-de-informacion-16', 'in_progress'],
]

interface DemoItem {
  title: string
  kind: AcademicItemKind
  subject: string | null
  /** Days from today; negative is overdue. */
  inDays: number
  hour: number
  done?: boolean
}

const EXAMPLE_NOTE = 'Fecha de ejemplo de la demo: no es del calendario de la facultad.'

export const DEMO_ITEMS: readonly DemoItem[] = [
  {
    title: 'Informe de relevamiento (TP 1)',
    kind: 'assignment',
    subject: 'analisis-de-sistemas-de-informacion-16',
    inDays: -2,
    hour: 23,
  },
  {
    title: 'Entrega TP 2: funciones de orden superior en Haskell',
    kind: 'assignment',
    subject: 'paradigmas-de-programacion-14',
    inDays: 0,
    hour: 23,
  },
  {
    title: 'Repasar guía de integrales dobles',
    kind: 'task',
    subject: 'analisis-matematico-ii-9',
    inDays: 0,
    hour: 18,
  },
  {
    title: 'Parcial de planificación de procesos',
    kind: 'midterm',
    subject: 'sistemas-operativos-15',
    inDays: 2,
    hour: 18,
  },
  {
    title: 'Reading comprehension: entrega',
    kind: 'assignment',
    subject: 'ingles-ii-12',
    inDays: 4,
    hour: 12,
  },
  {
    title: 'Inscribirme a la mesa de finales',
    kind: 'registration',
    subject: null,
    inDays: 6,
    hour: 10,
  },
  {
    title: 'Segundo parcial',
    kind: 'midterm',
    subject: 'analisis-matematico-ii-9',
    inDays: 8,
    hour: 9,
  },
  {
    title: 'Entrega TP 3: programación lógica',
    kind: 'assignment',
    subject: 'paradigmas-de-programacion-14',
    inDays: 11,
    hour: 23,
  },
  {
    title: 'Parcial integrador',
    kind: 'midterm',
    subject: 'analisis-de-sistemas-de-informacion-16',
    inDays: 12,
    hour: 19,
  },
  {
    title: 'Final de Física I',
    kind: 'final',
    subject: 'fisica-i-3',
    inDays: 13,
    hour: 8,
  },
  {
    title: 'Entrega TP 1: parser de expresiones',
    kind: 'assignment',
    subject: 'paradigmas-de-programacion-14',
    inDays: -12,
    hour: 23,
    done: true,
  },
]

export function demoResources(planSourceUrl: string | null): CreateResourceInput[] {
  const resources: CreateResourceInput[] = [
    {
      title: 'Documentación de Haskell',
      kind: 'link',
      curriculumSubjectId: 'paradigmas-de-programacion-14',
      url: 'https://www.haskell.org/documentation/',
      body: null,
    },
    {
      title: 'Resumen: autómatas finitos',
      kind: 'note',
      curriculumSubjectId: 'sintaxis-y-semantica-de-los-lenguajes-13',
      url: null,
      body:
        'Un AFD reconoce exactamente los lenguajes regulares.\n' +
        'Todo AFND tiene un AFD equivalente (construcción por subconjuntos).\n' +
        'Repasar: minimización y lema de bombeo.',
    },
    {
      title: 'Comandos que uso en el práctico',
      kind: 'note',
      curriculumSubjectId: 'sistemas-operativos-15',
      url: null,
      body: 'ps aux · top · kill -9 <pid> · nice -n 10 <cmd>',
    },
  ]
  if (planSourceUrl) {
    resources.unshift({
      title: 'Plan de estudios (fuente oficial)',
      kind: 'link',
      curriculumSubjectId: null,
      url: planSourceUrl,
      body: null,
    })
  }
  return resources
}

/** `today + days` at `hour`:00 local time, as ISO. */
export function relativeDate(now: Date, days: number, hour: number): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0, 0, 0)
  // An item "today at 18" when it is already 20 would read as overdue: keep
  // today's entries ahead of the clock.
  if (days === 0 && date.getTime() <= now.getTime()) {
    date.setTime(Math.min(now.getTime() + 60 * 60 * 1000, endOfDay(now).getTime()))
  }
  return date.toISOString()
}

function endOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0)
}

/**
 * Fill an empty backend with the demo student. Fails loudly if the catalog
 * does not carry the plan: a demo of an invented curriculum is worse than none.
 */
export async function seedDemo(backend: CampusBackend, now: Date = new Date()): Promise<void> {
  const curricula = await backend.catalog.curricula(DEMO_PROGRAM)
  const curriculum = curricula.find((c) => c.version === DEMO_CURRICULUM_VERSION)
  if (!curriculum)
    throw new Error('El catálogo no tiene el plan de la demo (UTN FRRo ISI 2023).')

  const bundle = await backend.catalog.curriculumBundle(curriculum.id)
  const known = new Set(bundle.subjects.map((s) => s.id))
  const missing = [
    ...DEMO_PROGRESS.map(([id]) => id),
    ...DEMO_ITEMS.flatMap((item) => (item.subject ? [item.subject] : [])),
  ].filter((id) => !known.has(id))
  if (missing.length > 0) {
    throw new Error(`La demo nombra materias que el plan no tiene: ${missing.join(', ')}`)
  }

  await backend.academic.saveContext({
    institutionId: DEMO_INSTITUTION,
    academicUnitId: DEMO_UNIT,
    programId: DEMO_PROGRAM,
    curriculumId: curriculum.id,
    unmappedLabel: null,
  })

  await backend.academic.setSubjectStatuses(
    DEMO_PROGRESS.map(([curriculumSubjectId, status]) => ({ curriculumSubjectId, status })),
  )

  for (const item of DEMO_ITEMS) {
    const created = await backend.items.create({
      title: item.title,
      kind: item.kind,
      curriculumSubjectId: item.subject,
      dueAt: relativeDate(now, item.inDays, item.hour),
      notes: EXAMPLE_NOTE,
    })
    if (item.done) await backend.items.setDone(created.id, true)
  }

  for (const resource of demoResources(curriculum.sourceUrl)) {
    await backend.resources.create(resource)
  }
}
