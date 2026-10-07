import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { DISMISSED_NOTES_KEY, useDismissedNotes } from './dismissed-notes'

/** Node 25 ships its own half-working `localStorage` that shadows jsdom's; use a plain one. */
function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  }
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true })
})

describe('dismissed order-conflict notes', () => {
  it('starts with nothing dismissed', () => {
    const { result } = renderHook(() => useDismissedNotes())
    expect(result.current.isDismissed('am2:passed:am1')).toBe(false)
  })

  it('remembers a dismissal across reloads', () => {
    const first = renderHook(() => useDismissedNotes())
    act(() => first.result.current.dismiss('am2:passed:am1'))
    first.unmount()

    const second = renderHook(() => useDismissedNotes())
    expect(second.result.current.isDismissed('am2:passed:am1')).toBe(true)
  })

  it('keeps two views of the same store in step (card and subject page)', () => {
    const a = renderHook(() => useDismissedNotes())
    const b = renderHook(() => useDismissedNotes())
    act(() => a.result.current.dismiss('k'))
    expect(b.result.current.isDismissed('k')).toBe(true)
  })

  it('treats unreadable storage as "nothing dismissed" instead of throwing', () => {
    window.localStorage.setItem(DISMISSED_NOTES_KEY, '{not json')
    const { result } = renderHook(() => useDismissedNotes())
    expect(result.current.isDismissed('x')).toBe(false)
  })
})
