import { describe, expect, it } from 'vitest'

import { isWithinCircularMask } from './dot-matrix'

/**
 * The mask is the only reason the indicator reads as a circle rather than a
 * square, and it is three lines of arithmetic that no type checks. A change to
 * the grid size or the radius turns it back into a square in a way a glance at
 * a running animation does not catch.
 */
describe('isWithinCircularMask', () => {
  const cells = Array.from({ length: 25 }, (_, i) => ({ row: Math.floor(i / 5), col: i % 5 }))

  it('drops exactly the four corners', () => {
    const out = cells.filter(({ row, col }) => !isWithinCircularMask(row, col))

    expect(out).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 4 },
      { row: 4, col: 0 },
      { row: 4, col: 4 },
    ])
  })

  it('keeps the other twenty-one, including every edge midpoint', () => {
    expect(cells.filter(({ row, col }) => isWithinCircularMask(row, col))).toHaveLength(21)

    // The edge midpoints are what make the silhouette round instead of a
    // diamond — the first thing lost if the radius is tightened.
    for (const [row, col] of [
      [0, 2],
      [2, 0],
      [2, 4],
      [4, 2],
    ]) {
      expect(isWithinCircularMask(row!, col!)).toBe(true)
    }
  })

  it('keeps the centre', () => {
    expect(isWithinCircularMask(2, 2)).toBe(true)
  })
})
