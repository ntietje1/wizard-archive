import { describe, expect, it } from 'vite-plus/test'
import { CANVAS_HANDLE_POSITION } from '../../../types/canvas-domain-types'
import {
  getStrokeEndpointConnectionPosition,
  getStrokeEndpointPoint,
  pointsToCenterlinePathD,
  resizeStrokeNode,
} from '../stroke-node-model'
import type { StrokeNodeLike } from '../stroke-node-model'

describe('stroke node model', () => {
  it('resizes stroke geometry and scales authored size by the limiting axis', () => {
    const resized = resizeStrokeNode(
      {
        position: { x: 0, y: 0 },
        data: {
          bounds: { x: 0, y: 0, width: 100, height: 50 },
          points: [
            [0, 0, 0.5],
            [100, 50, 0.5],
          ],
          size: 10,
        },
      },
      { width: 200, height: 25, position: { x: 20, y: 30 } },
    )

    expect(resized.position).toEqual({ x: 20, y: 30 })
    expect(resized.data.bounds).toEqual({ x: 0, y: 0, width: 200, height: 25 })
    expect(resized.data.points).toEqual([
      [0, 0, 0.5],
      [200, 25, 0.5],
    ])
    expect(resized.data.size).toBe(5)
  })

  it('resolves endpoint coordinates and connection handle direction from absolute stroke points', () => {
    const node: StrokeNodeLike = {
      position: { x: 10, y: 20 },
      data: {
        bounds: { x: 0, y: 0, width: 100, height: 0 },
        points: [
          [0, 0, 0.5],
          [100, 0, 0.5],
        ],
        size: 4,
      },
    }

    expect(getStrokeEndpointPoint(node, 'start')).toEqual({ x: 10, y: 20 })
    expect(getStrokeEndpointPoint(node, 'end')).toEqual({ x: 110, y: 20 })
    expect(getStrokeEndpointConnectionPosition(node, 'start')).toBe(CANVAS_HANDLE_POSITION.Left)
    expect(getStrokeEndpointConnectionPosition(node, 'end')).toBe(CANVAS_HANDLE_POSITION.Right)
  })

  it('builds no centerline path for degenerate strokes', () => {
    expect(pointsToCenterlinePathD([])).toBe('')
    expect(pointsToCenterlinePathD([[0, 0, 0.5]])).toBe('')
    expect(
      pointsToCenterlinePathD([
        [0, 0, 0.5],
        [10, 5, 0.5],
      ]),
    ).toBe('M 0 0 L 10 5')
  })
})
