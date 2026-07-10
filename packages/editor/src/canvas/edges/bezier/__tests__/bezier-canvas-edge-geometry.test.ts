import { describe, expect, it } from 'vite-plus/test'
import { CANVAS_HANDLE_POSITION } from '../../../types/canvas-domain-types'
import {
  buildBezierCanvasEdgeGeometryFromEdge,
  buildBezierCanvasEdgeGeometryFromRenderProps,
} from '../bezier-canvas-edge-geometry'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'

function getLongestHitPointSegment(points: ReadonlyArray<{ x: number; y: number }>) {
  let longestSegment = 0

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    longestSegment = Math.max(longestSegment, Math.hypot(end.x - start.x, end.y - start.y))
  }

  return longestSegment
}

describe('buildBezierCanvasEdgeGeometryFromRenderProps', () => {
  it('samples long curves densely enough for hit testing', () => {
    const shortCurve = buildBezierCanvasEdgeGeometryFromRenderProps({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 0,
      sourcePosition: CANVAS_HANDLE_POSITION.Right,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })
    const longCurve = buildBezierCanvasEdgeGeometryFromRenderProps({
      sourceX: 0,
      sourceY: 0,
      targetX: 5_000,
      targetY: 0,
      sourcePosition: CANVAS_HANDLE_POSITION.Right,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })

    expect(longCurve.hitPoints.length).toBeGreaterThan(shortCurve.hitPoints.length)
    expect(getLongestHitPointSegment(longCurve.hitPoints)).toBeLessThanOrEqual(80)
  })

  it('uses negative-distance curvature when handles point away from each other', () => {
    const geometry = buildBezierCanvasEdgeGeometryFromRenderProps({
      sourceX: 100,
      sourceY: 0,
      targetX: 50,
      targetY: 0,
      sourcePosition: CANVAS_HANDLE_POSITION.Right,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })
    const controlPoints = parseCubicPath(geometry.path)

    expect(controlPoints).not.toBeNull()
    expect(controlPoints?.control1.x).toBeGreaterThan(100)
    expect(controlPoints?.control2.x).toBeLessThan(50)
    expect(geometry.hitPoints[0]).toEqual({ x: 100, y: 0 })
    expect(geometry.hitPoints.at(-1)).toEqual({ x: 50, y: 0 })
  })
})

describe('buildBezierCanvasEdgeGeometryFromEdge', () => {
  it('returns null when endpoint nodes are unavailable', () => {
    expect(buildBezierCanvasEdgeGeometryFromEdge(createEdge(), new Map())).toBeNull()
  })

  it('resolves top and bottom handles from node bounds', () => {
    const sourceNode = createNode('source', 0, 0, 100, 100)
    const targetNode = createNode('target', 200, 200, 100, 100)
    const geometry = buildBezierCanvasEdgeGeometryFromEdge(
      createEdge({ sourceHandle: 'bottom', targetHandle: 'top' }),
      new Map([
        [sourceNode.id, sourceNode],
        [targetNode.id, targetNode],
      ]),
    )

    expect(geometry?.path).toBe('M 50,100 C 50,150 250,150 250,200')
    expect(geometry?.hitPoints[0]).toEqual({ x: 50, y: 100 })
    expect(geometry?.hitPoints.at(-1)).toEqual({ x: 250, y: 200 })
  })
})

function createNode(id: string, x: number, y: number, width = 100, height = 50): Node {
  return {
    id,
    type: 'text',
    position: { x, y },
    width,
    height,
    data: {},
  }
}

function createEdge(overrides: Partial<Edge> = {}): Edge {
  return {
    id: 'edge-1',
    type: 'bezier',
    source: 'source',
    target: 'target',
    sourceHandle: 'right',
    targetHandle: 'left',
    ...overrides,
  }
}

function parseCubicPath(path: string) {
  const match = path.match(/^M ([^,]+),([^ ]+) C ([^,]+),([^ ]+) ([^,]+),([^ ]+) ([^,]+),([^ ]+)$/)
  if (!match) return null
  const [, startX, startY, control1X, control1Y, control2X, control2Y, endX, endY] =
    match.map(Number)

  return {
    start: { x: startX, y: startY },
    control1: { x: control1X, y: control1Y },
    control2: { x: control2X, y: control2Y },
    end: { x: endX, y: endY },
  }
}
