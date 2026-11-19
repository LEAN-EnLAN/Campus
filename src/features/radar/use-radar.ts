import { useEffect, useMemo, useState } from 'react'

import { buildRadar, type RadarInsight } from '@/domain/radar'
import type { AcademicItem, SubjectView } from '@/domain/types'
import { hasUserTime } from '@/features/items/due'

/** How often the Radar re-reads the clock while the page is open. */
export const RADAR_TICK_MS = 60_000

/**
 * The current time, refreshed every minute and whenever the student comes back
 * to the window (focus, or the tab becoming visible again after a sleep).
 */
export function useRadarClock(tickMs: number = RADAR_TICK_MS): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => setNow(new Date())
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const timer = window.setInterval(refresh, tickMs)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tickMs])
  return now
}

export interface UseRadarInput {
  items: readonly AcademicItem[]
  subjects: readonly SubjectView[]
  prerequisitesKnown: boolean
  /** When the items last arrived (`query.dataUpdatedAt`), so a save counts as an update. */
  dataUpdatedAt?: number
}

export interface RadarState {
  insights: RadarInsight[]
  /** The clock the cards were computed against. Hoy uses it for its lists too. */
  now: Date
  /** The last time the cards were recomputed: a clock tick or new data. */
  updatedAt: Date
}

/**
 * The Radar, always on. Runs on this device only: it reads what the screen
 * already loaded and sends nothing anywhere.
 */
export function useRadar({
  items,
  subjects,
  prerequisitesKnown,
  dataUpdatedAt = 0,
}: UseRadarInput): RadarState {
  const now = useRadarClock()
  const insights = useMemo(
    () => buildRadar({ items, subjects, prerequisitesKnown, now, hasTime: hasUserTime }),
    [items, subjects, prerequisitesKnown, now],
  )
  const updatedAt = useMemo(
    () => new Date(Math.max(now.getTime(), dataUpdatedAt)),
    [now, dataUpdatedAt],
  )
  return { insights, now, updatedAt }
}

/** "actualizado recién" / "actualizado hace 3 min". */
export function updatedLabel(updatedAt: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - updatedAt.getTime()) / 60_000)
  if (minutes < 1) return 'actualizado recién'
  if (minutes < 60) return `actualizado hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `actualizado hace ${hours} h`
}
