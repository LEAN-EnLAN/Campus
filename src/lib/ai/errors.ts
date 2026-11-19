/**
 * What can go wrong talking to Anthropic, in words a student can act on.
 *
 * The raw API message is never shown and never logged: it is in English, it is
 * not actionable, and nothing about the key belongs anywhere but the request.
 */

export type AssistantErrorKind =
  | 'invalid_key'
  | 'permission'
  | 'billing'
  | 'not_found'
  | 'rate_limit'
  | 'overloaded'
  | 'server'
  | 'bad_request'
  | 'network'
  | 'aborted'
  | 'refusal'

const MESSAGES: Record<AssistantErrorKind, string> = {
  invalid_key: 'La clave no es válida o fue revocada. Revisala en Ajustes → Asistente.',
  permission:
    'Tu clave no tiene permiso para usar este modelo. Probá con otro en Ajustes → Asistente.',
  billing:
    'Tu cuenta de Anthropic no tiene crédito disponible. Cargalo en la consola de Anthropic y probá de nuevo.',
  not_found: 'Ese modelo no está disponible para tu clave. Elegí otro en Ajustes → Asistente.',
  rate_limit: 'Hiciste muchas consultas seguidas. Esperá un momento y probá de nuevo.',
  overloaded: 'Anthropic está saturado en este momento. Probá de nuevo en unos minutos.',
  server: 'Anthropic tuvo un problema al responder. Probá de nuevo en un rato.',
  bad_request:
    'No se pudo procesar la consulta. Probá reformularla o empezá una conversación nueva.',
  network: 'No hay conexión con Anthropic. Revisá tu internet y probá de nuevo.',
  aborted: 'Frenaste la respuesta.',
  refusal: 'Claude no puede responder esa consulta. Probá preguntarlo de otra forma.',
}

export function friendlyMessage(kind: AssistantErrorKind): string {
  return MESSAGES[kind]
}

export class AssistantError extends Error {
  readonly kind: AssistantErrorKind
  readonly status: number | null

  constructor(kind: AssistantErrorKind, status: number | null = null) {
    super(friendlyMessage(kind))
    this.name = 'AssistantError'
    this.kind = kind
    this.status = status
  }
}

/** The API's own error `type`, which also arrives mid-stream without a status. */
export function kindFromErrorType(type: string | undefined): AssistantErrorKind | null {
  switch (type) {
    case 'authentication_error':
      return 'invalid_key'
    case 'permission_error':
      return 'permission'
    case 'billing_error':
      return 'billing'
    case 'not_found_error':
      return 'not_found'
    case 'rate_limit_error':
      return 'rate_limit'
    case 'overloaded_error':
      return 'overloaded'
    case 'api_error':
    case 'timeout_error':
      return 'server'
    case 'invalid_request_error':
    case 'request_too_large':
      return 'bad_request'
    default:
      return null
  }
}

export function kindFromStatus(status: number, type?: string): AssistantErrorKind {
  const byType = kindFromErrorType(type)
  if (byType) return byType
  if (status === 401) return 'invalid_key'
  if (status === 402) return 'billing'
  if (status === 403) return 'permission'
  if (status === 404) return 'not_found'
  if (status === 429) return 'rate_limit'
  if (status === 529) return 'overloaded'
  if (status >= 500) return 'server'
  return 'bad_request'
}

/** Read `{ error: { type } }` from a failed response without trusting its shape. */
export async function errorFromResponse(response: Response): Promise<AssistantError> {
  let type: string | undefined
  try {
    const body: unknown = await response.json()
    type = errorTypeOf(body)
  } catch {
    /* not JSON: the status decides */
  }
  return new AssistantError(kindFromStatus(response.status, type), response.status)
}

export function errorTypeOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const error = (body as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return undefined
  const type = (error as { type?: unknown }).type
  return typeof type === 'string' ? type : undefined
}

/** Anything thrown by a request, as an AssistantError. */
export function toAssistantError(error: unknown, signal?: AbortSignal): AssistantError {
  if (error instanceof AssistantError) return error
  if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
    return new AssistantError('aborted')
  }
  return new AssistantError('network')
}
