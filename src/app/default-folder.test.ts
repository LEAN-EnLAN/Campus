import { describe, expect, it } from 'vitest'

import { suggestFolder } from './default-folder'

describe('suggestFolder', () => {
  it('puts Campus inside Documents when there is one', () => {
    expect(suggestFolder({ path: '/home/ana', dirs: ['Descargas', 'Documents'] })).toEqual({
      path: '/home/ana/Documents/Campus',
      label: 'Documents/Campus',
    })
  })

  it('knows the Spanish name too', () => {
    expect(suggestFolder({ path: '/home/ana', dirs: ['Documentos'] })).toEqual({
      path: '/home/ana/Documentos/Campus',
      label: 'Documentos/Campus',
    })
  })

  it('falls back to Campus at the top when there is no Documents', () => {
    expect(suggestFolder({ path: '/home/ana', dirs: ['Música'] })).toEqual({
      path: '/home/ana/Campus',
      label: 'Campus',
    })
  })

  it('keeps the separator of the machine it came from', () => {
    expect(suggestFolder({ path: 'C:\\Users\\ana', dirs: ['Documents'] })).toEqual({
      path: 'C:\\Users\\ana\\Documents\\Campus',
      label: 'Documents\\Campus',
    })
  })

  it('does not double the separator of a root', () => {
    expect(suggestFolder({ path: '/', dirs: [] })).toEqual({ path: '/Campus', label: 'Campus' })
  })
})
