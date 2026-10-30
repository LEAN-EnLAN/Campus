import { describe, expect, it } from 'vitest'

import {
  EMPTY_DRAFT,
  classifyIncoming,
  draftFromIncoming,
  extractHttpUrl,
  hostLabel,
  isHttpUrl,
  titleFromText,
  titleFromUrl,
  validateDraft,
} from './resource-draft'

describe('isHttpUrl / extractHttpUrl', () => {
  it('accepts http(s) URLs and nothing else', () => {
    expect(isHttpUrl('https://campus.unr.edu.ar/apunte')).toBe(true)
    expect(isHttpUrl('  http://example.com  ')).toBe(true)
    expect(isHttpUrl('ftp://example.com')).toBe(false)
    expect(isHttpUrl('campus.unr.edu.ar')).toBe(false)
    expect(isHttpUrl('https://')).toBe(false)
    expect(isHttpUrl('https://a b.com')).toBe(false)
  })

  it('only treats text that is entirely a URL as a link', () => {
    expect(extractHttpUrl('  https://example.com/x \n')).toBe('https://example.com/x')
    expect(extractHttpUrl('mirá esto https://example.com')).toBeNull()
    expect(extractHttpUrl('')).toBeNull()
  })

  it('skips uri-list comments and takes the first URL', () => {
    expect(extractHttpUrl('# copied\r\nhttps://a.com/one\r\nhttps://b.com/two')).toBe(
      'https://a.com/one',
    )
  })
})

describe('hostLabel', () => {
  it('drops www.', () => {
    expect(hostLabel('https://www.youtube.com/watch?v=1')).toBe('youtube.com')
  })
})

describe('titleFromUrl', () => {
  it('de-slugifies the last meaningful segment and strips the extension', () => {
    expect(titleFromUrl('https://campus.unr.edu.ar/apuntes/analisis-matematico_II.pdf')).toBe(
      'Analisis matematico II',
    )
  })

  it('decodes percent-encoded segments', () => {
    expect(titleFromUrl('https://example.com/guias/Gu%C3%ADa%20de%20pr%C3%A1ctica.pdf')).toBe(
      'Guía de práctica',
    )
  })

  it('skips generic words and opaque ids, falling back to the host', () => {
    expect(
      titleFromUrl('https://docs.google.com/document/d/1AbCdEfGh2IjKlMnOp3QrStUv/edit'),
    ).toBe('docs.google.com')
    expect(titleFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube.com')
    expect(titleFromUrl('https://www.fceia.unr.edu.ar/')).toBe('fceia.unr.edu.ar')
  })

  it('keeps an earlier segment when the last one is an id', () => {
    expect(titleFromUrl('https://example.com/parcial-resuelto/12345')).toBe('Parcial resuelto')
  })

  it('is deterministic', () => {
    const url = 'https://example.com/teoria/unidad-3-limites.html'
    expect(titleFromUrl(url)).toBe(titleFromUrl(url))
    expect(titleFromUrl(url)).toBe('Unidad 3 limites')
  })
})

describe('titleFromText', () => {
  it('uses the first non-empty line', () => {
    expect(titleFromText('\n  Resumen   parcial 1 \nresto')).toBe('Resumen parcial 1')
  })

  it('cuts long lines at a word boundary', () => {
    const title = titleFromText(
      'Esta es una nota bastante larga que habla de integrales dobles y triples en coordenadas polares',
    )
    expect(title.endsWith('…')).toBe(true)
    expect(title.length).toBeLessThanOrEqual(61)
    expect(title).not.toMatch(/\s…$/)
  })
})

describe('classifyIncoming', () => {
  it('prefers the uri-list', () => {
    expect(classifyIncoming({ uriList: 'https://example.com/tp-2.pdf', text: 'TP 2' })).toEqual(
      { kind: 'link', url: 'https://example.com/tp-2.pdf', title: 'Tp 2' },
    )
  })

  it('reads a URL from plain text', () => {
    expect(classifyIncoming({ text: ' https://example.com/apunte ' })).toMatchObject({
      kind: 'link',
      url: 'https://example.com/apunte',
    })
  })

  it('turns other text into a note', () => {
    expect(classifyIncoming({ text: 'Traer calculadora\nal parcial' })).toEqual({
      kind: 'note',
      body: 'Traer calculadora\nal parcial',
      title: 'Traer calculadora',
    })
  })

  it('reports files before anything else, so nothing is faked', () => {
    expect(classifyIncoming({ fileCount: 1, text: 'apunte.pdf' })).toEqual({ kind: 'file' })
  })

  it('reports empty payloads', () => {
    expect(classifyIncoming({ text: '   ' })).toEqual({ kind: 'empty' })
    expect(classifyIncoming({})).toEqual({ kind: 'empty' })
  })
})

describe('draftFromIncoming', () => {
  it('builds link and note drafts', () => {
    expect(draftFromIncoming({ kind: 'link', url: 'https://a.com', title: 'a.com' })).toEqual({
      kind: 'link',
      title: 'a.com',
      url: 'https://a.com',
      body: '',
    })
    expect(draftFromIncoming({ kind: 'note', body: 'hola', title: 'hola' })).toEqual({
      kind: 'note',
      title: 'hola',
      url: '',
      body: 'hola',
    })
  })
})

describe('validateDraft', () => {
  it('requires a title', () => {
    expect(validateDraft({ ...EMPTY_DRAFT, url: 'https://a.com' })).toEqual({
      ok: false,
      errors: { title: 'Poné un título para el material.' },
    })
  })

  it('requires an http(s) link for links', () => {
    expect(validateDraft({ ...EMPTY_DRAFT, title: 'Apunte', url: 'campus.edu' })).toEqual({
      ok: false,
      errors: { url: 'Ingresá un link que empiece con https:// o http://.' },
    })
  })

  it('returns trimmed values ready to save', () => {
    expect(
      validateDraft({ kind: 'link', title: ' Apunte ', url: ' https://a.com ', body: 'x' }),
    ).toEqual({
      ok: true,
      value: { kind: 'link', title: 'Apunte', url: 'https://a.com', body: null },
    })
    expect(validateDraft({ kind: 'note', title: 'N', url: 'junk', body: '  ' })).toEqual({
      ok: true,
      value: { kind: 'note', title: 'N', url: null, body: null },
    })
  })
})
