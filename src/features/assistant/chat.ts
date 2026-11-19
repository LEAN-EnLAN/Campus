import {
  isToolUseBlock,
  streamMessage,
  type MessageParam,
  type ToolResultBlock,
} from '@/lib/ai/anthropic-client'
import { AssistantError } from '@/lib/ai/errors'

import { buildContextHeader, type AssistantData } from './context'
import type { AssistantSettings } from './storage'
import { ASSISTANT_TOOLS, dispatchTool, SYSTEM_PROMPT, type ItemProposal } from './tools'

/** A runaway tool loop costs the student money; a real answer needs 1–3 rounds. */
export const MAX_TOOL_ROUNDS = 6

export interface TurnCallbacks {
  onText?: (delta: string) => void
  onProposal?: (proposal: ItemProposal) => void
}

export function systemPromptFor(data: AssistantData): string {
  return `${SYSTEM_PROMPT}\n\nContexto del estudiante:\n${buildContextHeader(data)}`
}

/**
 * One student question → the assistant's answer, running tools as asked.
 *
 * Returns the conversation with this turn appended (assistant turns verbatim,
 * thinking blocks included, as the API requires). Throws `AssistantError`; the
 * caller keeps its previous history so a failed turn leaves no half-answer.
 */
export async function runAssistantTurn({
  settings,
  history,
  question,
  data,
  signal,
  fetchImpl,
  callbacks = {},
}: {
  settings: AssistantSettings
  history: readonly MessageParam[]
  question: string
  data: AssistantData
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  callbacks?: TurnCallbacks
}): Promise<MessageParam[]> {
  const messages: MessageParam[] = [...history, { role: 'user', content: question }]
  const system = systemPromptFor(data)

  let wroteText = false
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let separated = !wroteText
    const response = await streamMessage({
      apiKey: settings.apiKey,
      model: settings.model,
      system,
      messages,
      tools: ASSISTANT_TOOLS,
      signal,
      fetchImpl,
      onText: (delta) => {
        // Text from a later round starts a new paragraph, not mid-sentence.
        if (!separated) {
          callbacks.onText?.('\n\n')
          separated = true
        }
        wroteText = true
        callbacks.onText?.(delta)
      },
    })
    if (response.stopReason === 'refusal') throw new AssistantError('refusal')

    const calls = response.content.filter(isToolUseBlock)
    // A tool input cut off by max_tokens can still look valid: never run it.
    if (response.stopReason === 'max_tokens' && calls.length > 0) {
      throw new AssistantError('bad_request')
    }
    messages.push({ role: 'assistant', content: response.content })
    if (response.stopReason !== 'tool_use' || calls.length === 0) return messages

    const results: ToolResultBlock[] = calls.map((call) => {
      const outcome = dispatchTool(call, data, {
        invalidJson: response.invalidToolUseIds.includes(call.id),
      })
      if (outcome.proposal) callbacks.onProposal?.(outcome.proposal)
      return outcome.result
    })
    // Every result of a round goes back in ONE user message.
    messages.push({ role: 'user', content: results })
  }
  throw new AssistantError('bad_request')
}
