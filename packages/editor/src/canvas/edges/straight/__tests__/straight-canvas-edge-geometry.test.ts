import { describe, expect, it } from 'vite-plus/test'
import {
  buildStraightCanvasEdgeGeometryFromEdge,
  buildStraightCanvasEdgeGeometryFromRenderProps,
} from '../straight-canvas-edge-geometry'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'

describe('buildStraightCanvasEdgeGeometryFromRenderProps', () => {
  it('builds a straight path, midpoint label, and hit points from render props', () => {
    expect(
      buildStraightCanvasEdgeGeometryFromRenderProps({
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 20,
      }),
    ).toEqual({
      path: 'M 0,0 L 10,20',
      labelX: 5,
      labelY: 10,
      hitPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
      ],
    })
  })
})

describe('buildStraightCanvasEdgeGeometryFromEdge', () => {
  it('resolves endpoint nodes before building straight geometry', () => {
    const sourceNode = createNode('source', 0, 0, 100, 50)
    const targetNode = createNode('target', 200, 0, 100, 50)

    expect(
      buildStraightCanvasEdgeGeometryFromEdge(
        createEdge(),
        new Map([
          [sourceNode.id, sourceNode],
          [targetNode.id, targetNode],
        ]),
      ),
    ).toEqual({
      path: 'M 100,25 L 200,25',
      labelX: 150,
      labelY: 25,
      hitPoints: [
        { x: 100, y: 25 },
        { x: 200, y: 25 },
      ],
    })
  })

  it('returns null when endpoints cannot be resolved', () => {
    expect(buildStraightCanvasEdgeGeometryFromEdge(createEdge(), new Map())).toBeNull()
  })
})

function createNode(id: string, x: number, y: number, width: number, height: number): Node {
  return {
    id,
    type: 'text',
    position: { x, y },
    width,
    height,
    data: {},
  }
}

function createEdge(): Edge {
  return {
    id: 'edge-1',
    type: 'straight',
    source: 'source',
    target: 'target',
    sourceHandle: 'right',
    targetHandle: 'left',
  }
}
