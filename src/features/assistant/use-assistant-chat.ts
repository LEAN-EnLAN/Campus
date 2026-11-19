import { useRef, useState } from 'react'

import type { MessageParam } from '@/lib/ai/anthropic-client'
import { toAssistantError } from '@/lib/ai/errors'

import { runAssistantTurn } from './chat'
import type { AssistantData } from './context'
import type { AssistantSettings } from './storage'
import type { ItemProposal } from './tools'

export interface ChatEntry {
  id: number
  role: 'user' | 'assistant'
  text: string
  proposals: ItemProposal[]
  state: 'streaming' | 'done' | 'stopped' | 'error'
  error?: string
}

/**
 * The conversation as the panel shows it, plus the API history behind it.
 *
 * The history only advances when a turn finishes: a stopped or failed answer
 * stays on screen (marked) but is not sent back as context next time.
 */
export function useAssistantChat(
  settings: AssistantSettings | null,
  data: AssistantData | null,
) {
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [busy, setBusy] = useState(false)
  const history = useRef<MessageParam[]>([])
  const controller = useRef<AbortController | null>(null)
  const nextId = useRef(1)

  function patch(id: number, update: (entry: ChatEntry) => ChatEntry) {
    setEntries((all) => all.map((entry) => (entry.id === id ? update(entry) : entry)))
  }

  async function send(question: string) {
    const text = question.trim()
    if (!text || busy || !settings || !data) return
    const userId = nextId.current++
    const answerId = nextId.current++
    setEntries((all) => [
      ...all,
      { id: userId, role: 'user', text, proposals: [], state: 'done' },
      { id: answerId, role: 'assistant', text: '', proposals: [], state: 'streaming' },
    ])
    setBusy(true)
    const abort = new AbortController()
    controller.current = abort
    try {
      history.current = await runAssistantTurn({
        settings,
        history: history.current,
        question: text,
        data,
        signal: abort.signal,
        callbacks: {
          onText: (delta) => patch(answerId, (e) => ({ ...e, text: e.text + delta })),
          onProposal: (p) => patch(answerId, (e) => ({ ...e, proposals: [...e.proposals, p] })),
        },
      })
      patch(answerId, (e) => ({ ...e, state: 'done' }))
    } catch (error) {
      const failure = toAssistantError(error, abort.signal)
      patch(answerId, (e) =>
        failure.kind === 'aborted'
          ? { ...e, state: 'stopped' }
          : { ...e, state: 'error', error: failure.message },
      )
    } finally {
      controller.current = null
      setBusy(false)
    }
  }

  function stop() {
    controller.current?.abort()
  }

  function reset() {
    stop()
    history.current = []
    setEntries([])
  }

  return { entries, busy, send, stop, reset }
}
