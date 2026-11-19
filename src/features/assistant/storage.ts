import { useSyncExternalStore } from 'react'

import {
  DEFAULT_ASSISTANT_MODEL,
  isAssistantModel,
  type AssistantModelId,
} from '@/lib/ai/models'

/**
 * The assistant's settings live on this device only.
 *
 * One localStorage key, nothing else: the API key is never copied into another
 * key, a query cache, telemetry, the data export or a Campus server. Clearing it
 * removes the whole entry.
 */
export const ASSISTANT_STORAGE_KEY = 'campus.assistant.v1'
const CHANGE_EVENT = 'campus-assistant-change'

export interface AssistantSettings {
  apiKey: string
  model: AssistantModelId
}

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function parse(raw: string | null): AssistantSettings | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { apiKey, model } = value as { apiKey?: unknown; model?: unknown }
    if (typeof apiKey !== 'string' || apiKey.trim() === '') return null
    return { apiKey, model: isAssistantModel(model) ? model : DEFAULT_ASSISTANT_MODEL }
  } catch {
    return null
  }
}

export function readAssistantSettings(): AssistantSettings | null {
  try {
    return parse(storage()?.getItem(ASSISTANT_STORAGE_KEY) ?? null)
  } catch {
    return null
  }
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function saveAssistantSettings(settings: AssistantSettings): void {
  const apiKey = settings.apiKey.trim()
  if (!apiKey) return
  storage()?.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify({ apiKey, model: settings.model }))
  notify()
}

export function clearAssistantSettings(): void {
  storage()?.removeItem(ASSISTANT_STORAGE_KEY)
  notify()
}

/** "…a1b2": enough to recognise a key, never enough to use it. */
export function maskApiKey(apiKey: string): string {
  return `…${apiKey.slice(-4)}`
}

// --- React ---------------------------------------------------------------------

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ASSISTANT_STORAGE_KEY) onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function snapshot(): string | null {
  try {
    return storage()?.getItem(ASSISTANT_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

/** The current settings, re-rendering when they change here or in another tab. */
export function useAssistantSettings(): AssistantSettings | null {
  // The raw string is the snapshot (stable across reads); parsing it is cheap.
  const raw = useSyncExternalStore(subscribe, snapshot, () => null)
  return parse(raw)
}
