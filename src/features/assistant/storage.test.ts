import { beforeEach, describe, expect, it } from 'vitest'

import {
  ASSISTANT_STORAGE_KEY,
  clearAssistantSettings,
  maskApiKey,
  readAssistantSettings,
  saveAssistantSettings,
} from './storage'

const KEY = 'sk-ant-api03-very-secret-value-1234'

function everyStoredValue(): string {
  const values: string[] = []
  for (const store of [window.localStorage, window.sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      const name = store.key(i)!
      values.push(`${name}=${store.getItem(name)}`)
    }
  }
  return values.join('\n')
}

describe('assistant key storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('round-trips the key and model under its one key', () => {
    saveAssistantSettings({ apiKey: `  ${KEY}  `, model: 'claude-haiku-5-5' })
    expect(readAssistantSettings()).toEqual({ apiKey: KEY, model: 'claude-haiku-5-5' })
    expect(Object.keys(window.localStorage)).toEqual([ASSISTANT_STORAGE_KEY])
  })

  it('never leaks the key into any other storage key', () => {
    window.localStorage.setItem('campus.theme', 'dark')
    saveAssistantSettings({ apiKey: KEY, model: 'claude-sonnet-5-5' })
    const leaks = everyStoredValue()
      .split('\n')
      .filter((entry) => entry.includes(KEY) && !entry.startsWith(`${ASSISTANT_STORAGE_KEY}=`))
    expect(leaks).toEqual([])
    expect(window.sessionStorage.length).toBe(0)
  })

  it('clearing removes the whole entry', () => {
    saveAssistantSettings({ apiKey: KEY, model: 'claude-sonnet-5-5' })
    clearAssistantSettings()
    expect(readAssistantSettings()).toBeNull()
    expect(everyStoredValue()).not.toContain(KEY)
  })

  it('reads garbage or an unknown model safely', () => {
    window.localStorage.setItem(ASSISTANT_STORAGE_KEY, '{nope')
    expect(readAssistantSettings()).toBeNull()
    window.localStorage.setItem(
      ASSISTANT_STORAGE_KEY,
      JSON.stringify({ apiKey: KEY, model: 'gpt' }),
    )
    expect(readAssistantSettings()?.model).toBe('claude-sonnet-5-5')
  })

  it('ignores an empty key', () => {
    saveAssistantSettings({ apiKey: '   ', model: 'claude-sonnet-5-5' })
    expect(window.localStorage.length).toBe(0)
  })

  it('masks to the last four characters', () => {
    expect(maskApiKey(KEY)).toBe('…1234')
  })
})
