import { describe, expect, it } from 'vitest'
import { boundsUnion, polygonIntersectsBounds } from '../canvas-geometry-utils'

describe('canvas geometry bounds helpers', () => {
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
