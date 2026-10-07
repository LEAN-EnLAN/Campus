/**
 * The footnote under the calendar for items that have no date to sit on.
 *
 * The promise it makes — "Se ven en Hoy" — is kept by the "Sin fecha" group on
 * Hoy. If that group goes away, this sentence has to go with it.
 */
export function undatedNote(count: number): string {
  return count === 1
    ? '1 cosa sin fecha no entra en el calendario. Se ve en Hoy.'
    : `${count} cosas sin fecha no entran en el calendario. Se ven en Hoy.`
}
