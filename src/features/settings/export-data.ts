import type {
  AcademicContext,
  AcademicItem,
  ManualSubject,
  Resource,
  UserSubjectState,
} from '@/domain/types'

/**
 * "Descargar mis datos": everything the student put into Campus, as one JSON
 * file they can read without Campus. Built in the page from what the backend
 * already returns — nothing passes through a server to make it.
 */

/** Bumped when a field changes meaning or moves; readers check it first. */
export const EXPORT_FORMAT_VERSION = 1

/** Who the data belongs to, as the app knows them in this mode. */
export type ExportProfile =
  { workspace: 'cloud'; email: string | null } | { workspace: 'local'; folderName: string }

export interface CampusExport {
  format: 'campus-export'
  version: typeof EXPORT_FORMAT_VERSION
  exportedAt: string
  profile: ExportProfile
  academicContext: AcademicContext | null
  subjectStates: UserSubjectState[]
  manualSubjects: ManualSubject[]
  items: AcademicItem[]
  resources: Resource[]
}

export function buildExport(
  data: Omit<CampusExport, 'format' | 'version' | 'exportedAt'>,
  now: Date,
): CampusExport {
  return {
    format: 'campus-export',
    version: EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    ...data,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const day = (now: Date) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

export function exportFileName(now: Date): string {
  return `campus-mis-datos-${day(now)}.json`
}

export function calendarFileName(now: Date): string {
  return `campus-mis-fechas-${day(now)}.ics`
}
