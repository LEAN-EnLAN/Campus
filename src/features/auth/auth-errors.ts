/**
 * What went wrong with Campus Cloud, in words that point at the right culprit.
 *
 * The old message blamed the student's connection for every network failure, so
 * someone on a working Wi-Fi retried and rebooted a router while the service was
 * simply not there. The browser knows one thing that settles it: `navigator.onLine`.
 * Offline is the student's to fix; online with a silent service is not.
 */

export function cloudUnreachableMessage(online: boolean): string {
  return online
    ? 'Campus Cloud no responde ahora. Tu conexión está bien: probá de nuevo en un rato.'
    : 'No tenés conexión a internet. Revisala y probá de nuevo.'
}

const UNREACHABLE = [
  'failed to fetch',
  'fetch failed',
  'networkerror',
  'network request failed',
  'load failed',
  'network',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
  'timeout',
  'timed out',
  '502',
  '503',
  '504',
]

/** Supabase error messages are in English; students are not. */
export function translateAuthError(message: string, online: boolean): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('user already registered')) return 'Ya existe una cuenta con ese email.'
  if (m.includes('password should be at least'))
    return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (m.includes('unable to validate email')) return 'Revisá el email, no parece válido.'
  if (
    m.includes('email rate limit') ||
    m.includes('rate limit') ||
    m.includes('for security purposes')
  )
    return 'Demasiados intentos. Probá de nuevo en un rato.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled'))
    return 'El registro de cuentas está deshabilitado por ahora.'
  if (UNREACHABLE.some((needle) => m.includes(needle))) return cloudUnreachableMessage(online)
  return 'No pudimos completar la operación. Probá de nuevo.'
}
