import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { EditorHandle } from './note-editor'
import { useEditorGuard } from './editor-guard'

/**
 * Nothing the student typed is thrown away without them being asked (DEV-02).
 * The guard sits between "close / switch / leave" and the editors that hold
 * the text.
 */

function handle(path: string, unsavedAfterFlush = false) {
  let unsaved = true
  const h: EditorHandle & { flushed: number } = {
    path,
    flushed: 0,
    flush: async () => {
      h.flushed += 1
      unsaved = unsavedAfterFlush
    },
    unsaved: () => unsaved,
  }
  return h
}

afterEach(() => vi.restoreAllMocks())

describe('settle', () => {
  it('flushes the matching editors and lets the caller proceed when everything saved', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { result } = renderHook(() => useEditorGuard())
    const a = handle('a.md')
    const b = handle('b.md')
    result.current.register(a)
    result.current.register(b)

    expect(await result.current.settle((p) => p === 'a.md')).toBe(true)
    expect(a.flushed).toBe(1)
    expect(b.flushed).toBe(0)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('asks before discarding text that could not be saved, and obeys the answer', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { result } = renderHook(() => useEditorGuard())
    result.current.register(handle('a.md', true))

    confirm.mockReturnValueOnce(false)
    expect(await result.current.settle()).toBe(false)
    expect(confirm).toHaveBeenCalledWith(
      'Esta nota tiene cambios que no se pudieron guardar. ¿Salir y perderlos?',
    )

    confirm.mockReturnValueOnce(true)
    expect(await result.current.settle()).toBe(true)
  })

  it('names how many notes when several are affected', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { result } = renderHook(() => useEditorGuard())
    result.current.register(handle('a.md', true))
    result.current.register(handle('b.md', true))
    await result.current.settle()
    expect(confirm).toHaveBeenCalledWith(
      'Hay 2 notas con cambios que no se pudieron guardar. ¿Salir y perderlas?',
    )
  })

  it('an unregistered editor is no longer asked', async () => {
    const { result } = renderHook(() => useEditorGuard())
    const a = handle('a.md', true)
    const off = result.current.register(a)
    off()
    expect(await result.current.settle()).toBe(true)
    expect(a.flushed).toBe(0)
  })
})

describe('closing the browser tab', () => {
  const fire = (type: 'beforeunload' | 'pagehide') => {
    const event = new Event(type, { cancelable: true })
    window.dispatchEvent(event)
    return event
  }

  it('warns and starts saving while an editor holds unsaved text', () => {
    const { result } = renderHook(() => useEditorGuard())
    const a = handle('a.md')
    result.current.register(a)

    const event = fire('beforeunload')
    expect(event.defaultPrevented).toBe(true)
    expect(a.flushed).toBe(1)
  })

  it('stays silent when everything is saved', () => {
    const { result } = renderHook(() => useEditorGuard())
    const a = handle('a.md')
    a.unsaved = () => false
    result.current.register(a)
    expect(fire('beforeunload').defaultPrevented).toBe(false)
  })

  it('pagehide also tries to flush, without prompting', () => {
    const { result } = renderHook(() => useEditorGuard())
    const a = handle('a.md')
    result.current.register(a)
    fire('pagehide')
    expect(a.flushed).toBe(1)
  })

  it('removes its listeners on unmount', () => {
    const { result, unmount } = renderHook(() => useEditorGuard())
    const a = handle('a.md')
    result.current.register(a)
    unmount()
    expect(fire('beforeunload').defaultPrevented).toBe(false)
  })
})
