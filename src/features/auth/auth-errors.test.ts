import { describe, expect, it } from 'vitest'

import { cloudUnreachableMessage, translateAuthError } from './auth-errors'

describe('translateAuthError', () => {
  it('says there is no connection when the device is offline', () => {
    expect(translateAuthError('Failed to fetch', false)).toBe(
      'No tenés conexión a internet. Revisala y probá de nuevo.',
    )
  })

  it('does not blame the connection when the device is online and the service is silent', () => {
    const text = translateAuthError('Failed to fetch', true)

    expect(text).toBe(
      'Campus Cloud no responde ahora. Tu conexión está bien: probá de nuevo en un rato.',
    )
    expect(text).not.toMatch(/Revisá tu conexión/)
  })

  it.each(['fetch failed', 'NetworkError when attempting to fetch resource.', 'Load failed'])(
    'treats "%s" as the service not answering',
    (message) => {
      expect(translateAuthError(message, true)).toMatch(/Campus Cloud no responde/)
    },
  )

  it.each(['502 Bad Gateway', 'Service Unavailable', 'upstream request timeout'])(
    'treats "%s" as the service not answering',
    (message) => {
      expect(translateAuthError(message, true)).toMatch(/Campus Cloud no responde/)
    },
  )

  it('keeps the specific messages for specific problems', () => {
    expect(translateAuthError('Invalid login credentials', true)).toBe(
      'Email o contraseña incorrectos.',
    )
    expect(translateAuthError('User already registered', true)).toBe(
      'Ya existe una cuenta con ese email.',
    )
  })

  it('never lets an English message through', () => {
    expect(translateAuthError('something exploded', true)).toBe(
      'No pudimos completar la operación. Probá de nuevo.',
    )
  })
})

describe('cloudUnreachableMessage', () => {
  it('tells offline from the service being down', () => {
    expect(cloudUnreachableMessage(false)).toMatch(/conexión a internet/)
    expect(cloudUnreachableMessage(true)).toMatch(/Campus Cloud no responde/)
  })
})
