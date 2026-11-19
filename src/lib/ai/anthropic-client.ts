import {
  AssistantError,
  errorFromResponse,
  kindFromErrorType,
  toAssistantError,
} from './errors'
import type { AssistantModelId } from './models'
import { readSse } from './sse'

/**
 * Bring-your-own-key client for the Claude Messages API.
 *
 * Plain `fetch` + an SSE reader instead of the official SDK: the assistant
 * needs one endpoint, and the request is spelled out here so it is obvious
 * what leaves the device. Requests go straight from the student's browser to
 * Anthropic (`anthropic-dangerous-direct-browser-access`) — never through a
 * Campus server — and the key is only ever written into the `x-api-key` header.
 */

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1'
export const ANTHROPIC_VERSION = '2026-10-21'
/** Server-side refusal fallback; only the Sonnet route sends it. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

// --- Wire types (the subset this app sends and reads) ------------------------

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

/**
 * Anything else the model returns (thinking, fallback markers…). Kept verbatim
 * and sent back unchanged on the next request, as the API requires.
 */
export interface OpaqueBlock {
  type: string
  [field: string]: unknown
}

export type ResponseBlock = TextBlock | ToolUseBlock | OpaqueBlock

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export type MessageParam =
  | { role: 'user'; content: string | ToolResultBlock[] }
  | { role: 'assistant'; content: ResponseBlock[] }

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
  eager_input_streaming?: boolean
}

export function isTextBlock(block: ResponseBlock): block is TextBlock {
  return block.type === 'text' && typeof (block as TextBlock).text === 'string'
}

export function isToolUseBlock(block: ResponseBlock): block is ToolUseBlock {
  return block.type === 'tool_use'
}

// --- Requests -----------------------------------------------------------------

export interface StreamRequest {
  apiKey: string
  model: AssistantModelId
  system: string
  messages: MessageParam[]
  tools?: ToolDefinition[]
  maxTokens?: number
  signal?: AbortSignal
  /** Each piece of visible text as it arrives. */
  onText?: (delta: string) => void
  fetchImpl?: typeof fetch
}

export interface StreamResult {
  content: ResponseBlock[]
  stopReason: string | null
  /** Tool calls whose streamed input was not valid JSON; answer them with an error. */
  invalidToolUseIds: string[]
}

function headers(apiKey: string, model: AssistantModelId): Record<string, string> {
  const out: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  }
  if (model === 'claude-sonnet-5-5') out['anthropic-beta'] = FALLBACK_BETA
  return out
}

export function buildRequestBody(request: StreamRequest): Record<string, unknown> {
  return {
    model: request.model,
    max_tokens: request.maxTokens ?? 8000,
    stream: true,
    system: request.system,
    messages: request.messages,
    // Chat about one student's week: shallow thinking is plenty and keeps it snappy.
    output_config: { effort: 'low' },
    ...(request.tools?.length ? { tools: request.tools } : {}),
    ...(request.model === 'claude-sonnet-5-5' ? { fallbacks: 'default' } : {}),
  }
}

/** Stream one Messages call and return the assembled assistant turn. */
export async function streamMessage(request: StreamRequest): Promise<StreamResult> {
  const doFetch = request.fetchImpl ?? globalThis.fetch.bind(globalThis)
  let response: Response
  try {
    response = await doFetch(`${ANTHROPIC_API_URL}/messages`, {
      method: 'POST',
      headers: headers(request.apiKey, request.model),
      body: JSON.stringify(buildRequestBody(request)),
      signal: request.signal,
    })
  } catch (error) {
    throw toAssistantError(error, request.signal)
  }
  if (!response.ok) throw await errorFromResponse(response)
  if (!response.body) throw new AssistantError('server', response.status)

  const assembler = createMessageAssembler(request.onText)
  try {
    for await (const frame of readSse(response.body)) {
      if (!frame.data) continue
      let payload: unknown
      try {
        payload = JSON.parse(frame.data)
      } catch {
        continue
      }
      assembler.apply(payload)
    }
  } catch (error) {
    throw toAssistantError(error, request.signal)
  }
  return assembler.result()
}

/** Is this key good for this model? `GET /v1/models/{id}` — validates both, costs nothing. */
export async function checkApiKey(
  apiKey: string,
  model: AssistantModelId,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  let response: Response
  try {
    response = await doFetch(`${ANTHROPIC_API_URL}/models/${model}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      signal: options.signal,
    })
  } catch (error) {
    throw toAssistantError(error, options.signal)
  }
  if (!response.ok) throw await errorFromResponse(response)
}

// --- Stream assembly -------------------------------------------------------------

type Json = Record<string, unknown>

function asObject(value: unknown): Json | null {
  return typeof value === 'object' && value !== null ? (value as Json) : null
}

/**
 * Folds stream events into the final content blocks. Exposed for tests: the
 * network is mocked there, this is where correctness lives.
 */
export function createMessageAssembler(onText?: (delta: string) => void) {
  const blocks: ResponseBlock[] = []
  const partialJson = new Map<number, string>()
  const invalid: string[] = []
  let stopReason: string | null = null

  return {
    apply(payload: unknown) {
      const event = asObject(payload)
      if (!event) return
      const index = typeof event.index === 'number' ? event.index : -1

      switch (event.type) {
        case 'content_block_start': {
          const block = asObject(event.content_block)
          if (!block || typeof block.type !== 'string') return
          blocks[index] = { ...block } as ResponseBlock
          if (block.type === 'tool_use') partialJson.set(index, '')
          return
        }
        case 'content_block_delta': {
          const block = blocks[index] as Json | undefined
          const delta = asObject(event.delta)
          if (!block || !delta) return
          if (delta.type === 'text_delta' && typeof delta.text === 'string') {
            block.text = `${typeof block.text === 'string' ? block.text : ''}${delta.text}`
            onText?.(delta.text)
          } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
            block.thinking = `${typeof block.thinking === 'string' ? block.thinking : ''}${delta.thinking}`
          } else if (delta.type === 'signature_delta' && typeof delta.signature === 'string') {
            block.signature = delta.signature
          } else if (
            delta.type === 'input_json_delta' &&
            typeof delta.partial_json === 'string'
          ) {
            partialJson.set(index, (partialJson.get(index) ?? '') + delta.partial_json)
          }
          return
        }
        case 'content_block_stop': {
          const block = blocks[index] as Json | undefined
          if (!block || block.type !== 'tool_use') return
          const raw = partialJson.get(index) ?? ''
          try {
            block.input = raw.trim() === '' ? {} : (JSON.parse(raw) as unknown)
          } catch {
            // The API needs a valid object echoed back; the caller answers with an error.
            block.input = {}
            if (typeof block.id === 'string') invalid.push(block.id)
          }
          return
        }
        case 'message_delta': {
          const delta = asObject(event.delta)
          if (delta && typeof delta.stop_reason === 'string') stopReason = delta.stop_reason
          return
        }
        case 'error': {
          const error = asObject(event.error)
          const type = error && typeof error.type === 'string' ? error.type : undefined
          throw new AssistantError(kindFromErrorType(type) ?? 'server')
        }
        default:
          return
      }
    },
    result(): StreamResult {
      // Holes (an index never started) and empty text blocks are dropped: the API
      // rejects an empty text block when the turn is sent back.
      const content = blocks.filter(
        (block): block is ResponseBlock =>
          block !== undefined && !(isTextBlock(block) && block.text === ''),
      )
      return { content, stopReason, invalidToolUseIds: invalid }
    },
  }
}
