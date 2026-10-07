import { describe, expect, it } from 'vitest'

import { undatedNote } from './undated-note'

describe('undatedNote', () => {
  it('agrees in number: one thing "se ve", several "se ven"', () => {
    expect(undatedNote(1)).toBe('1 cosa sin fecha no entra en el calendario. Se ve en Hoy.')
    expect(undatedNote(3)).toBe('3 cosas sin fecha no entran en el calendario. Se ven en Hoy.')
  })
})
