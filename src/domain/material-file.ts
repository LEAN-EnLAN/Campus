/**
 * Material files (CAP-RESOURCE-001) — what a student may upload, and where it lands.
 *
 * Pure: no I/O. The same limits are enforced again by the Storage bucket
 * (`supabase/migrations/20261119000100_material_files.sql`), so a client that
 * skips this check is still refused; this is what lets the dialog say why
 * before a single byte leaves the machine.
 */

/** 20 MB, the bucket's `file_size_limit`. */
export const MATERIAL_MAX_BYTES = 20 * 1024 * 1024

/** PDFs, images and office documents. Kept in sync with the bucket's `allowed_mime_types`. */
export const MATERIAL_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
]

/** For the file picker's `accept`. */
export const MATERIAL_ACCEPT = MATERIAL_MIME_TYPES.join(',')

export interface MaterialFileMeta {
  name: string
  type: string
  size: number
}

/** Why a file cannot be uploaded, in a sentence for the student; `null` when it can. */
export function materialFileProblem(file: MaterialFileMeta): string | null {
  if (file.size <= 0) return 'El archivo está vacío.'
  if (file.size > MATERIAL_MAX_BYTES) return 'El archivo pesa más de 20 MB.'
  if (!MATERIAL_MIME_TYPES.includes(file.type)) {
    return 'Ese tipo de archivo no se puede subir. Probá con un PDF, una imagen o un documento de Office.'
  }
  return null
}

/**
 * A filename safe to use as the last segment of a storage key: no separators,
 * no traversal, no control characters, accents folded, at most 100 characters
 * (extension kept). Never empty.
 */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  const ext = clean(dot > 0 ? base.slice(dot + 1) : '').slice(0, 10)
  const room = 100 - (ext === '' ? 0 : ext.length + 1)
  const stem = clean(dot > 0 ? base.slice(0, dot) : base).slice(0, room) || 'archivo'
  return ext === '' ? stem : `${stem}.${ext}`
}

/** Accents folded, control characters dropped, anything else outside [A-Za-z0-9_-] as one dash. */
function clean(part: string): string {
  return (
    part
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

/** `<owner>/<id>/<file>` — the first segment is what Storage RLS checks against `auth.uid()`. */
export function materialStoragePath(ownerId: string, id: string, fileName: string): string {
  return `${ownerId}/${id}/${safeFileName(fileName)}`
}

/** "2,4 MB" / "830 KB", for lists. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`
}

/** A title suggested from a filename: extension dropped, separators as spaces. */
export function titleFromFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  return stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || 'Archivo'
}
