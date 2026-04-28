import { describe, expect, it } from 'vitest'
import { boundsUnion, polygonIntersectsBounds, unionBounds } from '../canvas-geometry-utils'

describe('canvas geometry bounds helpers', () => {
  it('unions two bounds', () => {
    expect(
      unionBounds({ x: 10, y: 20, width: 30, height: 40 }, { x: -5, y: 35, width: 20, height: 10 }),
    ).toEqual({ x: -5, y: 20, width: 45, height: 40 })
  })

  it('unions zero-width and zero-height bounds', () => {
    expect(
      unionBounds({ x: 10, y: 10, width: 0, height: 20 }, { x: 5, y: 25, width: 10, height: 0 }),
    ).toEqual({ x: 5, y: 10, width: 10, height: 20 })
  })

  it('keeps the outer bounds when one rectangle fully contains another', () => {
    expect(
      unionBounds({ x: 0, y: 0, width: 100, height: 80 }, { x: 20, y: 10, width: 30, height: 20 }),
    ).toEqual({ x: 0, y: 0, width: 100, height: 80 })
  })

  it('unions bounds with negative coordinates across all corners', () => {
    expect(
      unionBounds(
        { x: -30, y: -20, width: 10, height: 70 },
        { x: 15, y: -40, width: 20, height: 15 },
      ),
    ).toEqual({ x: -30, y: -40, width: 65, height: 90 })
  })

  it('returns null for empty bounds collections', () => {
    expect(boundsUnion([])).toBeNull()
  })

  it('returns the single bounds item for one-item collections', () => {
    const bounds = { x: 1, y: 2, width: 3, height: 4 }

    expect(boundsUnion([bounds])).toBe(bounds)
  })

  it('unions multiple bounds items', () => {
    expect(
      boundsUnion([
        { x: 10, y: 20, width: 30, height: 40 },
        { x: -5, y: 35, width: 20, height: 10 },
        { x: 60, y: -10, width: 5, height: 15 },
      ]),
    ).toEqual({ x: -5, y: -10, width: 70, height: 70 })
  })

  it('returns false for empty polygons when testing bounds intersection', () => {
    expect(polygonIntersectsBounds([], { x: 0, y: 0, width: 10, height: 10 })).toBe(false)
  })
})
