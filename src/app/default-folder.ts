/**
 * The folder first-run offers in one click: `Campus`, inside Documents when the
 * top folder the server offers (the student's home) has one.
 *
 * Built from the server's own path and its own separator, never from the browser's
 * idea of the platform: the page may be open on a Mac while the folders live on a
 * Windows machine.
 */
const DOCUMENTS = ['Documents', 'Documentos']

export interface FolderSuggestion {
  /** Absolute path, as the server writes it. */
  path: string
  /** The part below the top folder, for showing: `Documents/Campus`. */
  label: string
}

export function suggestFolder(top: {
  path: string
  dirs: readonly string[]
}): FolderSuggestion {
  const separator = top.path.includes('\\') && !top.path.includes('/') ? '\\' : '/'
  const base = top.path.replace(/[\\/]+$/, '')
  const documents = DOCUMENTS.find((name) => top.dirs.includes(name))
  const label = documents ? `${documents}${separator}Campus` : 'Campus'
  return { path: `${base}${separator}${label}`, label }
}
