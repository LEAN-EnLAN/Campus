import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/utils'

/**
 * A pointer-and-keyboard Kanban board.
 *
 * The cards are yours: this owns dragging, hit testing, announcements and the
 * horizontal rail, and renders whatever `renderCard` returns. It stores no
 * order of its own — `columns` is the truth on every render, and `onMove` is
 * how you change it.
 */

export interface KanbanCard {
  id: string
}

export interface KanbanColumn<T extends KanbanCard> {
  id: string
  name: string
  /** Shown next to the name. */
  count?: number
  /** Rendered instead of cards when the column is empty. */
  empty?: ReactNode
  /** When false, cards cannot be dropped here and the column says why. */
  droppable?: boolean
  cards: T[]
}

export interface KanbanBoardProps<T extends KanbanCard> {
  columns: KanbanColumn<T>[]
  renderCard: (card: T) => ReactNode
  /**
   * Fires once per completed move.
   *
   * It cannot refuse one: the board never holds its own order, so the way to
   * reject a move is to not apply it to `columns` — the next render puts the
   * card back. A column that should never accept a card marks itself
   * `droppable: false` instead, which the drag can see and refuse before the
   * card is ever dropped.
   */
  onMove?: (move: { cardId: string; from: string; to: string; index: number }) => void
  label?: string
  className?: string
}

/** Vertical space between cards, in px. The snapshot maths depends on this. */
const GAP = 8
/** How close to the edge of the track the pointer must get before it scrolls. */
const EDGE_SCROLL_ZONE = 72
/** Pixels per frame at the very edge. */
const EDGE_SCROLL_SPEED = 14

/**
 * Where a card would land, precomputed at drag start.
 *
 * `mids` holds the vertical midpoint of every card in the column AS IF the
 * dragged card were already gone and the gap it left had closed.
 */
interface ColumnSnapshot {
  id: string
  droppable: boolean
  top: number
  bottom: number
  left: number
  right: number
  mids: number[]
}

interface DragState {
  cardId: string
  from: string
  /** Pointer offset inside the card, so the card does not jump under the cursor. */
  grabX: number
  grabY: number
  width: number
  height: number
  snapshots: ColumnSnapshot[]
}

interface DropTarget {
  column: string
  index: number
}

interface KeyboardState {
  cardId: string
  from: string
  fromIndex: number
  column: string
  index: number
}

export function KanbanBoard<T extends KanbanCard>({
  columns,
  renderCard,
  onMove,
  label = 'Tablero',
  className,
}: KanbanBoardProps<T>) {
  const reduceMotion = useReducedMotion()

  const trackRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const columnRefs = useRef(new Map<string, HTMLElement>())

  const [drag, setDrag] = useState<DragState | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const [keyboard, setKeyboard] = useState<KeyboardState | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const columnById = useMemo(() => {
    const map = new Map<string, KanbanColumn<T>>()
    for (const column of columns) map.set(column.id, column)
    return map
  }, [columns])

  const cardById = useMemo(() => {
    const map = new Map<string, { card: T; column: string; index: number }>()
    for (const column of columns)
      column.cards.forEach((card, index) =>
        map.set(card.id, { card, column: column.id, index }),
      )
    return map
  }, [columns])

  const draggedCard = drag ? (cardById.get(drag.cardId)?.card ?? null) : null

  // --- Hit testing -----------------------------------------------------------

  /**
   * Take the snapshot the whole drag will be decided against.
   *
   * Measuring live is the obvious implementation and it is the wrong one. The
   * placeholder that opens at the candidate slot pushes the cards below it
   * down, past the pointer; the next measurement therefore reads a different
   * slot; the placeholder moves; the cards come back up; the original slot wins
   * again. The card oscillates between two positions for as long as you hold
   * still. So we measure ONCE, with the dragged card removed and the gap it
   * left closed, and every decision for the rest of the drag reads that frozen
   * geometry.
   */
  const snapshot = useCallback(
    (cardId: string, fromColumn: string): ColumnSnapshot[] => {
      return columns.map((column) => {
        const element = columnRefs.current.get(column.id)
        const box = element?.getBoundingClientRect()
        const mids: number[] = []

        // How much everything below the dragged card shifts up once it leaves.
        const dragged = cardRefs.current.get(cardId)
        const collapse =
          column.id === fromColumn && dragged ? dragged.getBoundingClientRect().height + GAP : 0
        let passedDragged = false

        for (const card of column.cards) {
          if (card.id === cardId) {
            passedDragged = true
            continue
          }
          const node = cardRefs.current.get(card.id)
          if (!node) continue
          const rect = node.getBoundingClientRect()
          mids.push(rect.top + rect.height / 2 - (passedDragged ? collapse : 0))
        }

        return {
          id: column.id,
          droppable: column.droppable !== false,
          top: box?.top ?? 0,
          bottom: box?.bottom ?? 0,
          left: box?.left ?? 0,
          right: box?.right ?? 0,
          mids,
        }
      })
    },
    [columns],
  )

  const resolveTarget = useCallback(
    (state: DragState, clientX: number, clientY: number): DropTarget | null => {
      const column =
        state.snapshots.find((s) => clientX >= s.left && clientX <= s.right) ??
        // Past either end of the track, hold the nearest column rather than
        // dropping the target entirely — the card has to land somewhere.
        state.snapshots.reduce<ColumnSnapshot | null>((best, s) => {
          if (!best) return s
          const d = Math.min(Math.abs(clientX - s.left), Math.abs(clientX - s.right))
          const bd = Math.min(Math.abs(clientX - best.left), Math.abs(clientX - best.right))
          return d < bd ? s : best
        }, null)

      if (!column || !column.droppable) return null

      let index = column.mids.length
      for (let i = 0; i < column.mids.length; i += 1) {
        if (clientY < column.mids[i]!) {
          index = i
          break
        }
      }

      return { column: column.id, index }
    },
    [],
  )

  // --- Pointer drag ----------------------------------------------------------

  const beginDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, cardId: string, fromColumn: string) => {
      // Left button only; let the browser have its context menu and its text
      // selection on everything else.
      if (event.button !== 0) return
      const node = cardRefs.current.get(cardId)
      if (!node) return

      const rect = node.getBoundingClientRect()
      const state: DragState = {
        cardId,
        from: fromColumn,
        grabX: event.clientX - rect.left,
        grabY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
        snapshots: snapshot(cardId, fromColumn),
      }

      x.set(rect.left)
      y.set(rect.top)
      setDrag(state)
      setTarget(resolveTarget(state, event.clientX, event.clientY))
      setKeyboard(null)
    },
    [resolveTarget, snapshot, x, y],
  )

  useEffect(() => {
    if (!drag) return

    let frame = 0
    let edgeVelocity = 0

    const step = () => {
      const track = trackRef.current
      if (track && edgeVelocity !== 0) track.scrollLeft += edgeVelocity
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)

    const onPointerMove = (event: PointerEvent) => {
      x.set(event.clientX - drag.grabX)
      y.set(event.clientY - drag.grabY)
      setTarget(resolveTarget(drag, event.clientX, event.clientY))

      const track = trackRef.current
      if (!track) return
      const box = track.getBoundingClientRect()
      if (event.clientX < box.left + EDGE_SCROLL_ZONE) {
        const depth = (box.left + EDGE_SCROLL_ZONE - event.clientX) / EDGE_SCROLL_ZONE
        edgeVelocity = -Math.ceil(depth * EDGE_SCROLL_SPEED)
      } else if (event.clientX > box.right - EDGE_SCROLL_ZONE) {
        const depth = (event.clientX - (box.right - EDGE_SCROLL_ZONE)) / EDGE_SCROLL_ZONE
        edgeVelocity = Math.ceil(depth * EDGE_SCROLL_SPEED)
      } else {
        edgeVelocity = 0
      }
    }

    const onPointerUp = () => {
      // A drop onto a non-droppable column resolves to no target at all, so the
      // card simply snaps back and nothing is reported.
      if (target && !(target.column === drag.from && isSameSlot(drag, target, cardById))) {
        onMove?.({
          cardId: drag.cardId,
          from: drag.from,
          to: target.column,
          index: target.index,
        })
      }
      setDrag(null)
      setTarget(null)
    }

    const onCancel = () => {
      setDrag(null)
      setTarget(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [cardById, drag, onMove, resolveTarget, target, x, y])

  // --- Keyboard --------------------------------------------------------------

  const announce = useCallback((message: string) => {
    setAnnouncement(message)
  }, [])

  const dropKeyboard = useCallback(
    (state: KeyboardState) => {
      if (state.column !== state.from || state.index !== state.fromIndex) {
        onMove?.({
          cardId: state.cardId,
          from: state.from,
          to: state.column,
          index: state.index,
        })
      }
      setKeyboard(null)
      announce(
        `Soltada en ${columnById.get(state.column)?.name ?? state.column}, posición ${state.index + 1}.`,
      )
    },
    [announce, columnById, onMove],
  )

  const onCardKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLElement>,
      cardId: string,
      columnId: string,
      index: number,
    ) => {
      const pickUpKey = event.key === ' ' || event.key === 'Enter' || event.key === 'Spacebar'

      if (!keyboard) {
        if (!pickUpKey) return
        event.preventDefault()
        setKeyboard({ cardId, from: columnId, fromIndex: index, column: columnId, index })
        announce(
          `Agarraste la tarjeta. Usá las flechas para moverla, espacio para soltarla, escape para cancelar.`,
        )
        return
      }

      if (keyboard.cardId !== cardId) return

      if (pickUpKey) {
        event.preventDefault()
        dropKeyboard(keyboard)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setKeyboard(null)
        announce('Cancelado. La tarjeta volvió a su lugar.')
        return
      }

      const order = columns.map((c) => c.id)
      const current = order.indexOf(keyboard.column)

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const size = sizeWithout(columnById.get(keyboard.column), keyboard.cardId)
        const next = clamp(keyboard.index + (event.key === 'ArrowDown' ? 1 : -1), 0, size)
        if (next === keyboard.index) return
        setKeyboard({ ...keyboard, index: next })
        announce(`Posición ${next + 1} de ${size + 1}.`)
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const direction = event.key === 'ArrowRight' ? 1 : -1

        // Skip past columns that refuse drops rather than parking the card on
        // one it can never be left in.
        let next = current + direction
        while (
          next >= 0 &&
          next < order.length &&
          columnById.get(order[next]!)?.droppable === false
        )
          next += direction
        if (next < 0 || next >= order.length) return

        const destination = columnById.get(order[next]!)
        const size = sizeWithout(destination, keyboard.cardId)
        const index = clamp(keyboard.index, 0, size)
        setKeyboard({ ...keyboard, column: order[next]!, index })
        announce(`${destination?.name ?? ''}, posición ${index + 1} de ${size + 1}.`)
      }
    },
    [announce, columnById, columns, dropKeyboard, keyboard],
  )

  /**
   * A keyboard move across columns re-mounts the card in its new parent, and a
   * re-mounted element is not the focused one any more — focus falls back to
   * `<body>` and the next arrow key goes nowhere. Put it back on the card the
   * user is still carrying.
   */
  useEffect(() => {
    if (!keyboard) return
    const node = cardRefs.current.get(keyboard.cardId)
    if (node && document.activeElement !== node) node.focus({ preventScroll: true })
  }, [keyboard])

  // --- The horizontal rail ---------------------------------------------------

  const [rail, setRail] = useState({ ratio: 1, offset: 0 })
  const [fade, setFade] = useState({ start: false, end: false })
  const railRef = useRef<HTMLDivElement | null>(null)
  const railDragRef = useRef<{ startX: number; startScroll: number } | null>(null)

  const measureRail = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const { scrollLeft, scrollWidth, clientWidth } = track
    const ratio = scrollWidth > 0 ? clientWidth / scrollWidth : 1
    setRail({ ratio, offset: scrollWidth > 0 ? scrollLeft / scrollWidth : 0 })
    setFade({ start: scrollLeft > 1, end: scrollLeft + clientWidth < scrollWidth - 1 })
  }, [])

  useLayoutEffect(() => {
    measureRail()
    const track = trackRef.current
    if (!track) return
    const observer = new ResizeObserver(measureRail)
    observer.observe(track)
    for (const child of Array.from(track.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [measureRail, columns])

  const onRailPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current
    if (!track) return
    event.currentTarget.setPointerCapture(event.pointerId)
    railDragRef.current = { startX: event.clientX, startScroll: track.scrollLeft }
  }

  const onRailPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current
    const state = railDragRef.current
    const railBox = railRef.current?.getBoundingClientRect()
    if (!track || !state || !railBox || railBox.width === 0) return
    const scale = track.scrollWidth / railBox.width
    track.scrollLeft = state.startScroll + (event.clientX - state.startX) * scale
  }

  const endRailDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    railDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // --- Render ----------------------------------------------------------------

  const duration = reduceMotion ? 0 : 0.16
  const spring = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.7 }

  const active =
    keyboard ?? (drag && target ? { column: target.column, index: target.index } : null)
  const carriedId = keyboard?.cardId ?? drag?.cardId ?? null

  return (
    <div className={cn('relative flex flex-col gap-2', className)}>
      <div
        ref={trackRef}
        role="group"
        aria-label={label}
        onScroll={measureRail}
        className={cn(
          'flex gap-3 overflow-x-auto overflow-y-visible pb-1',
          // The native scrollbar is hidden because the rail below replaces it.
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
        style={{
          // Fade only on a side that still has content past it, so the mask is
          // information rather than decoration.
          maskImage: maskFor(fade),
          WebkitMaskImage: maskFor(fade),
        }}
      >
        {columns.map((column) => {
          const droppable = column.droppable !== false
          const isTarget = active?.column === column.id
          const cards = column.cards.filter((card) => card.id !== carriedId)

          return (
            <section
              key={column.id}
              ref={(node) => {
                if (node) columnRefs.current.set(column.id, node)
                else columnRefs.current.delete(column.id)
              }}
              aria-label={column.name}
              className={cn(
                // Columns share the width when they fit and hold a floor when
                // they do not, instead of a fixed width picked for one screen:
                // three 288px columns overflow the 832px reading measure by
                // 56px, which clips the last one with no sign that it is there.
                // Growing avoids that; `shrink-0` keeps the track scrollable
                // once there are more columns than room.
                'bg-paper-sunken border-rule-soft flex shrink-0 grow basis-64 flex-col rounded-lg border',
                'max-w-80',
                isTarget && droppable && 'border-rule',
              )}
            >
              <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    droppable ? 'bg-accent' : 'bg-rule',
                  )}
                />
                <h3 className="text-ink truncate text-sm font-medium">{column.name}</h3>
                {column.count !== undefined ? (
                  <span className="text-ink-muted text-xs" data-numeric>
                    {column.count}
                  </span>
                ) : null}
              </header>

              <div className="flex flex-1 flex-col gap-2 p-2 pt-0">
                {cards.length === 0 && !isTarget ? (
                  <div className="text-ink-muted px-1 py-6 text-center text-xs">
                    {column.empty ?? (droppable ? null : 'No se puede soltar acá.')}
                  </div>
                ) : null}

                {slotsWithPlaceholder(cards, isTarget && droppable ? active.index : null).map(
                  (slot) =>
                    slot.kind === 'placeholder' ? (
                      <motion.div
                        key="kanban-placeholder"
                        layout
                        initial={{ height: 0, opacity: 0 }}
                        animate={{
                          height: drag ? drag.height : 64,
                          opacity: 1,
                        }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={spring}
                        aria-hidden="true"
                        className="border-rule bg-paper/40 rounded-md border border-dashed"
                      />
                    ) : (
                      <motion.article
                        key={slot.card.id}
                        layout
                        layoutId={slot.card.id}
                        transition={spring}
                        ref={(node: HTMLElement | null) => {
                          if (node) cardRefs.current.set(slot.card.id, node)
                          else cardRefs.current.delete(slot.card.id)
                        }}
                        tabIndex={0}
                        role="button"
                        aria-roledescription="tarjeta arrastrable"
                        aria-grabbed={keyboard?.cardId === slot.card.id}
                        onPointerDown={(event) => beginDrag(event, slot.card.id, column.id)}
                        onKeyDown={(event) =>
                          onCardKeyDown(event, slot.card.id, column.id, slot.index)
                        }
                        className={cn(
                          'bg-paper-elevated border-rule text-ink cursor-grab touch-none rounded-md border p-3 text-left select-none',
                          'transition-colors duration-150 ease-[var(--ease-out-quiet)]',
                          'hover:border-ink-faint',
                          'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
                          keyboard?.cardId === slot.card.id &&
                            'outline-accent outline-2 outline-offset-2',
                        )}
                      >
                        {renderCard(slot.card)}
                      </motion.article>
                    ),
                )}
              </div>
            </section>
          )
        })}
      </div>

      {/*
        An always-visible rail, because the platform's overlay scrollbar only
        fades in once you are already scrolling — the one moment you no longer
        need to be told that you can.
      */}
      {rail.ratio < 1 ? (
        <div
          ref={railRef}
          className="bg-rule-soft relative h-1.5 w-full overflow-hidden rounded-md"
        >
          <div
            role="presentation"
            onPointerDown={onRailPointerDown}
            onPointerMove={onRailPointerMove}
            onPointerUp={endRailDrag}
            onPointerCancel={endRailDrag}
            className="bg-rule hover:bg-ink-faint absolute inset-y-0 cursor-grab rounded-md transition-colors duration-150"
            style={{
              width: `${Math.max(rail.ratio * 100, 8)}%`,
              left: `${rail.offset * 100}%`,
            }}
          />
        </div>
      ) : null}

      {/* The floating card. The one place in this design system with a real shadow. */}
      <AnimatePresence>
        {drag && draggedCard ? (
          <motion.div
            key="kanban-drag-overlay"
            initial={{ scale: 1 }}
            animate={{ scale: reduceMotion ? 1 : 1.02 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            aria-hidden="true"
            style={{ x, y, width: drag.width }}
            className="bg-paper-elevated border-rule text-ink pointer-events-none fixed top-0 left-0 z-50 cursor-grabbing rounded-md border p-3 shadow-[var(--shadow-overlay)]"
          >
            {renderCard(draggedCard)}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}

// --- Helpers -----------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function maskFor({ start, end }: { start: boolean; end: boolean }): string | undefined {
  if (!start && !end) return undefined
  const from = start ? 'transparent, black 32px' : 'black'
  const to = end ? 'black calc(100% - 32px), transparent' : 'black'
  return `linear-gradient(to right, ${from}, ${to})`
}

/** How many cards a column would hold with the carried one taken out. */
function sizeWithout<T extends KanbanCard>(
  column: KanbanColumn<T> | undefined,
  cardId: string,
): number {
  if (!column) return 0
  return Math.max(column.cards.filter((c) => c.id !== cardId).length - 1, 0)
}

type Slot<T> = { kind: 'card'; card: T; index: number } | { kind: 'placeholder' }

function slotsWithPlaceholder<T extends KanbanCard>(cards: T[], at: number | null): Slot<T>[] {
  const slots: Slot<T>[] = cards.map((card, index) => ({ kind: 'card', card, index }))
  if (at === null) return slots
  slots.splice(clamp(at, 0, slots.length), 0, { kind: 'placeholder' })
  return slots
}

/** A drop back onto the slot the card came from is not a move. */
function isSameSlot<T extends KanbanCard>(
  drag: DragState,
  target: DropTarget,
  cardById: Map<string, { card: T; column: string; index: number }>,
): boolean {
  const origin = cardById.get(drag.cardId)
  if (!origin) return false
  return origin.column === target.column && origin.index === target.index
}
