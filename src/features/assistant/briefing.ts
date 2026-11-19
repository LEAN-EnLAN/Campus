import { isTextBlock, streamMessage } from '@/lib/ai/anthropic-client'
import type { AssistantModelId } from '@/lib/ai/models'

import {
  buildContextHeader,
  getPendingFinals,
  getUpcoming,
  type AssistantData,
} from './context'
import type { AssistantSettings } from './storage'
import { SYSTEM_PROMPT } from './tools'

/**
 * "Briefing del día": one paragraph about today, written from the student's
 * real dates and finals, cached per day in sessionStorage.
 */

export const BRIEFING_STORAGE_KEY = 'campus.assistant.briefing.v1'

/** Local to the assistant: the key never enters a query key, only the model does. */
export const briefingQueryKey = (day: string, model: AssistantModelId) =>
  ['assistant', 'briefing', day, model] as const

interface CachedBriefing {
  day: string
  model: string
  text: string
}

export function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function readCachedBriefing(day: string, model: string): string | null {
  try {
    const raw = window.sessionStorage.getItem(BRIEFING_STORAGE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as Partial<CachedBriefing>
    return cached.day === day && cached.model === model && typeof cached.text === 'string'
      ? cached.text
      : null
  } catch {
    return null
  }
}

export function writeCachedBriefing(entry: CachedBriefing | null) {
  try {
    if (entry) window.sessionStorage.setItem(BRIEFING_STORAGE_KEY, JSON.stringify(entry))
    else window.sessionStorage.removeItem(BRIEFING_STORAGE_KEY)
  } catch {
    /* private mode: no cache, still works */
  }
}

/** Everything the briefing may use, already trimmed to a week. */
export function briefingPrompt(data: AssistantData): string {
  const facts = {
    fechas: getUpcoming(data, 7),
    finales_pendientes: getPendingFinals(data).finales.slice(0, 3),
  }
  return [
    'Escribí el briefing del día: UN párrafo de 2 a 4 oraciones, sin listas ni títulos.',
    'Decí qué conviene hacer hoy y qué se viene en la semana, usando SOLO estos datos.',
    'Si no hay nada cargado, decilo y sugerí cargar las fechas de la cursada.',
    '',
    buildContextHeader(data),
    '',
    `Datos: ${JSON.stringify(facts)}`,
  ].join('\n')
}

export async function generateBriefing(
  settings: AssistantSettings,
  data: AssistantData,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const response = await streamMessage({
    apiKey: settings.apiKey,
    model: settings.model,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: briefingPrompt(data) }],
    maxTokens: 2000,
    ...options,
  })
  return response.content
    .filter(isTextBlock)
    .map((block) => block.text)
    .join('')
    .trim()
}
