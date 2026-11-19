import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RADAR_TICK_MS, updatedLabel, useRadar, useRadarClock } from './use-radar'

describe('useRadarClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 19, 10, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('re-reads the clock every minute', () => {
    const { result } = renderHook(() => useRadarClock())
    const first = result.current.getTime()
    act(() => {
      vi.advanceTimersByTime(RADAR_TICK_MS)
    })
    expect(result.current.getTime() - first).toBe(RADAR_TICK_MS)
  })

  it('re-reads the clock when the window gets focus back', () => {
    const { result } = renderHook(() => useRadarClock())
    const first = result.current.getTime()
    vi.setSystemTime(new Date(2026, 10, 19, 18, 0))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current.getTime()).toBeGreaterThan(first)
  })

  it('recomputes the cards as the day changes', () => {
    vi.setSystemTime(new Date(2026, 10, 19, 23, 59, 30))
    const items = [
      {
        id: 'x',
        curriculumSubjectId: null,
        kind: 'task' as const,
        title: 'Entrega',
        startsAt: null,
        dueAt: new Date(2026, 10, 20, 23, 59, 59, 999).toISOString(),
        status: 'open' as const,
        notes: null,
      },
    ]
    const { result } = renderHook(() =>
      useRadar({ items, subjects: [], prerequisitesKnown: true }),
    )
    expect(result.current.insights[0]?.countdown).toEqual({ unit: 'days', value: 1 })
    act(() => {
      vi.advanceTimersByTime(RADAR_TICK_MS)
    })
    expect(result.current.insights[0]?.countdown).toEqual({ unit: 'today' })
  })
})

describe('updatedLabel', () => {
  const at = new Date(2026, 10, 19, 10, 0)
  it('says how long ago, in minutes then hours', () => {
    expect(updatedLabel(at, at)).toBe('actualizado recién')
    expect(updatedLabel(at, new Date(at.getTime() + 60_000))).toBe('actualizado hace 1 min')
    expect(updatedLabel(at, new Date(at.getTime() + 2 * 3_600_000))).toBe(
      'actualizado hace 2 h',
    )
  })
})
