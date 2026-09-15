import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

import { usePrefersReducedMotion } from '@/lib/hooks/use-prefers-reduced-motion'
import { cn } from '@/lib/utils'

/**
 * A dot-matrix indicator: a square grid of dots whose brightness is a function
 * of position and time.
 *
 * Adapted from the `dotm-circular-7` variant. The upstream snippet imported a
 * `dotmatrix-core` / `dotmatrix-hooks` pair that was not published with it, so
 * the base, the mask and the hooks are implemented here. Two things changed on
 * the way in: the Next-only `"use client"` directive is gone (this is a Vite
 * app), and the dot colour is a Campus token rather than shadcn's
 * `--foreground`, which this project does not define.
 *
 * Nothing here animates under `prefers-reduced-motion` — the grid resolves to
 * its resting brightness and the rAF loop never starts.
 */

/** Cells per side. The circular mask is centred on index 2. */
const GRID = 5
const CENTER = (GRID - 1) / 2
/** Radius that keeps the edge midpoints and drops the four corners. */
const MASK_RADIUS = 2.5

export type DotMatrixPhase = 'idle' | 'running' | 'hover'

export type DotAnimationResolver = (args: {
  row: number
  col: number
  phase: DotMatrixPhase
}) => { className?: string; style?: CSSProperties }

export interface DotMatrixCommonProps {
  /** Overall side length in px. */
  size?: number
  /** Dot diameter in px. */
  dotSize?: number
  /** Multiplies the animation rate. Higher is faster. */
  speed?: number
  animated?: boolean
  /** Animate only while the pointer is over the grid. */
  hoverAnimated?: boolean
  className?: string
  /** Accessible name. Omit to leave the grid decorative (the default). */
  label?: string
}

/** Is this cell inside the circle, or one of the corners the mask drops? */
export function isWithinCircularMask(row: number, col: number): boolean {
  const dx = col - CENTER
  const dy = row - CENTER
  return Math.sqrt(dx * dx + dy * dy) <= MASK_RADIUS
}

/**
 * The looping clock, in `requestAnimationFrame`.
 *
 * Returns a normalised 0→1 position in the cycle. The loop is torn down when
 * `active` goes false, so a hidden or reduced-motion matrix costs nothing.
 */
export function useCyclePhase({
  active,
  cycleMsBase,
  speed = 1,
}: {
  active: boolean
  cycleMsBase: number
  speed?: number
}): number {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (!active) {
      setPhase(0)
      return
    }
    const duration = Math.max(1, cycleMsBase / Math.max(speed, 0.01))
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      setPhase((((now - start) % duration) / duration + 1) % 1)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, cycleMsBase, speed])

  return phase
}

/** Which phase the grid is in, plus the handlers that move it there. */
export function useDotMatrixPhases({
  animated,
  hoverAnimated,
}: {
  animated: boolean
  hoverAnimated: boolean
  speed?: number
}): {
  phase: DotMatrixPhase
  onMouseEnter: () => void
  onMouseLeave: () => void
} {
  const [hovered, setHovered] = useState(false)

  const onMouseEnter = useCallback(() => setHovered(true), [])
  const onMouseLeave = useCallback(() => setHovered(false), [])

  const phase: DotMatrixPhase = animated
    ? 'running'
    : hoverAnimated && hovered
      ? 'hover'
      : 'idle'

  return { phase, onMouseEnter, onMouseLeave }
}

/**
 * The grid itself. Layout only — every dot's appearance comes from the
 * resolver, which is what makes one base serve every variant.
 */
export function DotMatrixBase({
  size = 36,
  dotSize = 5,
  className,
  label,
  phase = 'idle',
  animationResolver,
  onMouseEnter,
  onMouseLeave,
}: {
  size?: number
  dotSize?: number
  className?: string
  label?: string
  speed?: number
  pattern?: 'full'
  animated?: boolean
  phase?: DotMatrixPhase
  reducedMotion?: boolean
  animationResolver: DotAnimationResolver
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}) {
  const cells = useMemo(
    () =>
      Array.from({ length: GRID * GRID }, (_, i) => ({
        row: Math.floor(i / GRID),
        col: i % GRID,
      })),
    [],
  )

  const gap = GRID > 1 ? (size - GRID * dotSize) / (GRID - 1) : 0

  return (
    <div
      // Decorative unless it is given a name: the loading COPY says what is
      // happening, and a screen reader announcing a grid of dots says nothing.
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn('grid shrink-0', className)}
      style={{
        width: size,
        height: size,
        gridTemplateColumns: `repeat(${GRID}, ${dotSize}px)`,
        gridAutoRows: `${dotSize}px`,
        gap: `${Math.max(gap, 0)}px`,
      }}
    >
      {cells.map(({ row, col }) => {
        const { className: dotClass, style } = animationResolver({ row, col, phase })
        return (
          <span
            key={`${row}-${col}`}
            className={cn('rounded-full', dotClass)}
            style={{
              width: dotSize,
              height: dotSize,
              backgroundColor: 'var(--color-dot-on)',
              ...style,
            }}
          />
        )
      })}
    </div>
  )
}

/** Masked-out corners keep their cell but show nothing. */
const INACTIVE: CSSProperties = { opacity: 0 }

const BASE_OPACITY = 0.08
const GATE_OPACITY = 0.92

/**
 * The circular variant: five petals rotating inside a ring, crossed by a
 * diagonal chord wave. The three waves are deliberately out of step so the
 * pattern never visibly repeats over a short loop.
 */
export function CircularDotMatrix({
  speed = 1.8,
  animated = true,
  hoverAnimated = false,
  ...rest
}: DotMatrixCommonProps) {
  const reducedMotion = usePrefersReducedMotion()
  const {
    phase: matrixPhase,
    onMouseEnter,
    onMouseLeave,
  } = useDotMatrixPhases({
    animated: Boolean(animated && !reducedMotion),
    hoverAnimated: Boolean(hoverAnimated && !reducedMotion),
    speed,
  })
  const phase = useCyclePhase({
    active: !reducedMotion && matrixPhase !== 'idle',
    cycleMsBase: 1600,
    speed,
  })

  const resolver = useMemo<DotAnimationResolver>(() => {
    return ({ row, col, phase: p }) => {
      if (!isWithinCircularMask(row, col)) return { style: INACTIVE }

      const x = col - CENTER
      const y = row - CENTER
      const t = reducedMotion || p === 'idle' ? 0 : phase * Math.PI * 2
      const ring = Math.sqrt(x * x + y * y)
      const angle = Math.atan2(y, x)

      const petalWave = 0.5 + 0.5 * Math.cos(5 * angle - t * 1.7)
      const ringWave = 0.5 + 0.5 * Math.cos(ring * 3.3 - t * 1.2)
      const chordWave = 0.5 + 0.5 * Math.cos((x + y) * 1.6 + t * 1.35)

      // Sharpen contrast so lit cells form clear, visible groups.
      const petalGate = Math.pow(petalWave, 2.2)
      const blend = 0.68 * petalGate + 0.22 * ringWave + 0.1 * chordWave

      return { style: { opacity: BASE_OPACITY + (GATE_OPACITY - BASE_OPACITY) * blend } }
    }
  }, [reducedMotion, phase])

  return (
    <DotMatrixBase
      {...rest}
      size={rest.size ?? 36}
      dotSize={rest.dotSize ?? 5}
      speed={speed}
      pattern="full"
      animated={animated}
      phase={matrixPhase}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      reducedMotion={reducedMotion}
      animationResolver={resolver}
    />
  )
}
