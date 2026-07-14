import { describe, expect, it } from 'vite-plus/test'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import {
  buildCanvasEdgeGeometryFromResolvedEndpoints,
  buildPolylinePath,
  canvasEdgeGeometryIntersectsPolygon,
  canvasEdgeGeometryIntersectsRectangle,
  compactPolylinePoints,
  getPolylineMidpoint,
} from '../canvas-edge-geometry'
import { CANVAS_HANDLE_POSITION } from '../../../types/canvas-domain-types'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'
import type { CanvasEdgeGeometry } from '../canvas-edge-geometry'

describe('buildCanvasEdgeGeometryFromResolvedEndpoints', () => {
  it('anchors stroke edges to the start and end stroke points instead of the bounding box', () => {
    const { nodeMap } = createStrokeEdgeFixture([
      [0, 10, 0.5],
      [100, 10, 0.5],
    ])

    const startEndpoints = captureResolvedEndpoints(
      {
        id: 'edge-start',
        source: testCanvasNodeId('stroke-1'),
        target: testCanvasNodeId('target-1'),
        sourceHandle: 'start',
        targetHandle: 'left',
      } as Edge,
      nodeMap,
    )
    const endEndpoints = captureResolvedEndpoints(
      {
        id: 'edge-end',
        source: testCanvasNodeId('stroke-1'),
        target: testCanvasNodeId('target-1'),
        sourceHandle: 'end',
        targetHandle: 'left',
      } as Edge,
      nodeMap,
    )

    expect(startEndpoints).toEqual({
      sourceX: 10,
      sourceY: 30,
      targetX: 200,
      targetY: 50,
      sourcePosition: CANVAS_HANDLE_POSITION.Left,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })
    expect(endEndpoints).toEqual({
      sourceX: 110,
      sourceY: 30,
      targetX: 200,
      targetY: 50,
      sourcePosition: CANVAS_HANDLE_POSITION.Right,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })
  })

  it.each([
    ['insufficient point tuple', [[0, 10]]],
    ['invalid pressure value', [[0, 10, 'bad']]],
  ])('falls back to regular node anchors when stroke data has an %s', (_label, points) => {
    const { nodeMap } = createStrokeEdgeFixture(points)

    expect(
      captureResolvedEndpoints(
        {
          id: 'edge-start',
          source: testCanvasNodeId('stroke-1'),
          target: testCanvasNodeId('target-1'),
          sourceHandle: 'start',
          targetHandle: 'left',
        } as Edge,
        nodeMap,
      ),
    ).toEqual({
      sourceX: 110,
      sourceY: 30,
      targetX: 200,
      targetY: 50,
      sourcePosition: CANVAS_HANDLE_POSITION.Right,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })
  })

  it('falls back to the regular right anchor for malformed stroke end handles', () => {
    const { nodeMap } = createStrokeEdgeFixture([[100, 10, 'bad']])

    expect(
      captureResolvedEndpoints(
        {
          id: 'edge-end',
          source: testCanvasNodeId('stroke-1'),
          target: testCanvasNodeId('target-1'),
          sourceHandle: 'end',
          targetHandle: 'left',
        } as Edge,
        nodeMap,
      ),
    ).toEqual({
      sourceX: 110,
      sourceY: 30,
      targetX: 200,
      targetY: 50,
      sourcePosition: CANVAS_HANDLE_POSITION.Right,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })
  })
})

describe('polyline geometry helpers', () => {
  it('compacts empty, single, and near-duplicate points', () => {
    expect(compactPolylinePoints([])).toEqual([])
    expect(compactPolylinePoints([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }])
    expect(
      compactPolylinePoints([
        { x: 0, y: 0 },
        { x: 0.0000001, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
  })

  it('builds SVG path text from polyline points', () => {
    expect(buildPolylinePath([])).toBe('')
    expect(
      buildPolylinePath([
        { x: 0, y: 0 },
        { x: 4, y: 5 },
      ]),
    ).toBe('M 0,0 L 4,5')
  })

  it('finds midpoints for empty, single, degenerate, and multi-segment polylines', () => {
    expect(getPolylineMidpoint([])).toEqual({ x: 0, y: 0 })
    expect(getPolylineMidpoint([{ x: 2, y: 3 }])).toEqual({ x: 2, y: 3 })
    expect(
      getPolylineMidpoint([
        { x: 2, y: 3 },
        { x: 2, y: 3 },
      ]),
    ).toEqual({ x: 2, y: 3 })
    expect(
      getPolylineMidpoint([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toEqual({ x: 10, y: 0 })
  })

  it('detects rectangle intersections when hit points touch the boundary', () => {
    const geometry = createGeometry([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])

    expect(
      canvasEdgeGeometryIntersectsRectangle(geometry, { x: 10, y: -5, width: 5, height: 10 }),
    ).toBe(true)
    expect(
      canvasEdgeGeometryIntersectsRectangle(geometry, { x: 20, y: 20, width: 5, height: 5 }),
    ).toBe(false)
  })

  it('detects polygon intersections when a polyline crosses the boundary', () => {
    const geometry = createGeometry([
      { x: -5, y: 0 },
      { x: 5, y: 0 },
    ])
    const polygon = [
      { x: 0, y: -5 },
      { x: 10, y: -5 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ]

    expect(canvasEdgeGeometryIntersectsPolygon(geometry, polygon)).toBe(true)
    expect(
      canvasEdgeGeometryIntersectsPolygon(
        createGeometry([
          { x: -10, y: -10 },
          { x: -6, y: -6 },
        ]),
        polygon,
      ),
    ).toBe(false)
  })
})

function captureResolvedEndpoints(edge: Edge, nodesById: ReadonlyMap<string, Node>): unknown {
  let resolvedEndpoints: unknown = null
  buildCanvasEdgeGeometryFromResolvedEndpoints(edge, nodesById, (endpoints): CanvasEdgeGeometry => {
    resolvedEndpoints = endpoints
    return {
      hitPoints: [],
      labelX: 0,
      labelY: 0,
      path: '',
    }
  })

  return resolvedEndpoints
}

function createStrokeEdgeFixture(points: unknown) {
  const strokeNode = {
    id: testCanvasNodeId('stroke-1'),
    type: 'stroke',
    position: { x: 10, y: 20 },
    width: 100,
    height: 20,
    data: {
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      points,
      color: 'var(--foreground)',
      size: 4,
    },
  } as unknown as Node
  const targetNode: Node = {
    id: testCanvasNodeId('target-1'),
    type: 'text',
    position: { x: 200, y: 20 },
    width: 80,
    height: 60,
    data: {},
  }
  const nodeMap = new Map([
    [strokeNode.id, strokeNode],
    [targetNode.id, targetNode],
  ])

  return { strokeNode, targetNode, nodeMap }
}

function createGeometry(hitPoints: CanvasEdgeGeometry['hitPoints']): CanvasEdgeGeometry {
  return {
    hitPoints,
    labelX: 0,
    labelY: 0,
    path: buildPolylinePath(hitPoints),
  }
}
