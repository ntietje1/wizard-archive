import { describe, expect, it } from 'vite-plus/test'
import {
  getStrokeHighlightPathSize,
  polylineIntersectsStroke,
  strokeNodeIntersectsPolygon,
  strokeNodeIntersectsRect,
} from '../stroke-node-interactions'
import type { StrokeNodeLike } from '../stroke-node-model'

describe('stroke node interactions', () => {
  it('intersects eraser trails that cross the rendered stroke thickness', () => {
    expect(
      polylineIntersectsStroke(
        [
          { x: 0, y: 5 },
          { x: 100, y: 5 },
        ],
        {
          id: 'stroke-1',
          color: 'var(--foreground)',
          points: [
            [0, 0, 0.5],
            [100, 0, 0.5],
          ],
          size: 12,
        },
      ),
    ).toBe(true)
  })

  it('does not treat hollow stroke interiors as erased stroke geometry', () => {
    expect(
      polylineIntersectsStroke(
        [
          { x: 50, y: 40 },
          { x: 50, y: 60 },
        ],
        {
          id: 'stroke-1',
          color: 'var(--foreground)',
          points: [
            [0, 0, 0.5],
            [100, 0, 0.5],
            [100, 100, 0.5],
            [0, 100, 0.5],
            [0, 0, 0.5],
          ],
          size: 4,
        },
      ),
    ).toBe(false)
  })

  it('matches rectangle selections that contain or cross the absolute stroke path', () => {
    const node = createStrokeNode()

    expect(strokeNodeIntersectsRect(node, { x: 5, y: 5, width: 4, height: 4 }, 100)).toBe(true)
    expect(strokeNodeIntersectsRect(node, { x: 14, y: 0, width: 3, height: 20 }, 100)).toBe(true)
    expect(strokeNodeIntersectsRect(node, { x: 100, y: 100, width: 10, height: 10 }, 100)).toBe(
      false,
    )
  })

  it('matches polygon selections that contain or cross the absolute stroke path', () => {
    const node = createStrokeNode()

    expect(
      strokeNodeIntersectsPolygon(
        node,
        [
          { x: 4, y: 4 },
          { x: 10, y: 4 },
          { x: 10, y: 10 },
          { x: 4, y: 10 },
        ],
        100,
      ),
    ).toBe(true)
    expect(
      strokeNodeIntersectsPolygon(
        node,
        [
          { x: 14, y: 0 },
          { x: 18, y: 0 },
          { x: 18, y: 10 },
          { x: 14, y: 10 },
        ],
        100,
      ),
    ).toBe(true)
    expect(
      strokeNodeIntersectsPolygon(
        node,
        [
          { x: 100, y: 100 },
          { x: 110, y: 100 },
          { x: 110, y: 110 },
          { x: 100, y: 110 },
        ],
        100,
      ),
    ).toBe(false)
  })

  it('sizes selected stroke highlights beyond the rendered stroke', () => {
    expect(getStrokeHighlightPathSize(4, 2)).toBe(10)
    expect(getStrokeHighlightPathSize(4, 0.5)).toBe(28)
  })
})

function createStrokeNode(): StrokeNodeLike {
  return {
    position: { x: 5, y: 5 },
    data: {
      bounds: { x: 0, y: 0, width: 10, height: 0 },
      points: [
        [0, 0, 0.5],
        [10, 0, 0.5],
      ],
      size: 2,
    },
  }
}
