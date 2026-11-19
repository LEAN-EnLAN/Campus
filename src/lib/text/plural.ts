/**
 * The word that goes with a count: `plural(1, 'materia', 'materias')`.
 *
 * Spanish has two forms for counts, and zero takes the plural ("0 materias").
 * The caller writes both words: guessing a plural from a suffix gets
 * "parcial → parcials" wrong.
 */
export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

/** The count and its word: `countLabel(3, 'materia', 'materias')` → "3 materias". */
export function countLabel(count: number, one: string, many: string): string {
  return `${count} ${plural(count, one, many)}`
}
