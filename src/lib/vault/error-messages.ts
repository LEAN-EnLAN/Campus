import { vaultErrorCode, type VaultErrorCode } from './errors'

/**
 * The only place a Vault refusal becomes something a student reads.
 *
 * One sentence per code, Spanish (voseo), no host paths, no file extensions and
 * no repeated names: the screen already shows which file the student was
 * touching, so repeating it only adds noise. Anything that is not a `VaultError`
 * gets the generic sentence — its own text is for a developer's console, and
 * it is exactly where English and absolute paths used to leak from.
 */
const MESSAGES: Record<VaultErrorCode, string> = {
  path_empty: 'Escribí un nombre.',
  path_absolute: 'Ese nombre no es válido: no empieces con / ni con una unidad como C:\\.',
  path_traversal: 'Ese nombre no es válido: no se puede usar «..» ni «.» como carpeta.',
  path_too_long: 'La ruta es demasiado larga: probá con un nombre más corto.',
  name_separator: 'Ese nombre no es válido: no uses / ni \\.',
  name_control_char: 'Ese nombre no es válido: tiene caracteres de control.',
  name_forbidden_char: 'Ese nombre no es válido: no uses : < > " | ? *',
  name_trailing_dot_space: 'Ese nombre no es válido: no puede terminar en punto ni en espacio.',
  name_reserved: 'Ese nombre está reservado por Windows.',

  outside_vault: 'Esa ubicación queda fuera de tu carpeta, así que Campus no la toca.',
  too_many_links: 'Esa ruta pasa por demasiados enlaces simbólicos encadenados.',
  symlink_unreadable: 'Esa ruta pasa por un enlace simbólico que no pudimos leer.',
  root_unreadable: 'No pudimos leer tu carpeta: revisá que siga ahí.',

  not_found: 'Eso ya no está en tu carpeta: se movió o se eliminó.',
  already_exists: 'Ya existe una nota con ese nombre.',
  destination_exists: 'Ya existe algo con ese nombre.',
  conflict_changed: 'Este archivo cambió fuera de Campus.',
  conflict_missing: 'Esta nota se movió o se eliminó.',
  permission_denied: 'Campus no tiene permiso para hacer eso en esa carpeta.',
  io_error: 'No pudimos completar la operación en tu carpeta: probá de nuevo.',

  folder_not_absolute: 'La ruta tiene que ser completa, desde la raíz del disco.',
  folder_not_found: 'No encontramos esa carpeta. Revisá la ruta.',
  folder_not_directory: 'Esa ruta no es una carpeta.',
  folder_outside_roots:
    'Esa carpeta queda fuera de las que Campus puede abrir: elegí una dentro de tu carpeta personal.',

  unauthorized: 'Campus no pudo conectarse con tu carpeta: recargá la página.',
  origin_not_allowed: 'Campus no pudo conectarse con tu carpeta: recargá la página.',
  unknown_vault: 'La sesión de tu carpeta se cerró: recargá la página para volver a abrirla.',
  bad_request: 'No pudimos completar la operación en tu carpeta: probá de nuevo.',
  unavailable: 'No pudimos comunicarnos con el servidor de Campus: probá de nuevo.',
  unknown: 'No pudimos completar la operación en tu carpeta: probá de nuevo.',
}

export function vaultErrorText(code: VaultErrorCode): string {
  return MESSAGES[code]
}

/** A Spanish sentence for anything thrown by a Vault operation. */
export function vaultErrorMessage(error: unknown): string {
  const code = vaultErrorCode(error)
  // `fetch` rejects with a TypeError when the server cannot be reached at all.
  if (code === 'unknown' && error instanceof TypeError) return MESSAGES.unavailable
  return MESSAGES[code]
}
