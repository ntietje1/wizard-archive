import { describe, expect, it } from 'vitest'
import {
  findCanvasEdgeAtPoint,
  getCanvasEdgesMatchingLasso,
  getCanvasEdgesMatchingRectangle,
} from '../canvas-edge-registry'
import type { Edge, Node } from '@xyflow/react'

function createNode(id: string, x: number, y: number): Node {
  return {
    id,
    type: 'text',
    position: { x, y },
    width: 40,
    height: 40,
    data: {},
  }
}

function createBezierEdge(overrides?: Partial<Edge>): Edge {
  return {
    id: 'edge-1',
    source: 'source',
    target: 'target',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'bezier',
    ...overrides,
  }
}

describe('canvas-edge-registry', () => {
  const nodes = [createNode('source', 0, 0), createNode('target', 160, 0)]

  it('matches the bezier edge on point hits using the rendered bezier geometry', () => {
    // findCanvasEdgeAtPoint samples the createBezierEdge curve between these nodes, so
    // {x:100,y:20} lands near the rendered arc while {x:100,y:70} stays well outside it.
    expect(findCanvasEdgeAtPoint(nodes, [createBezierEdge()], { x: 100, y: 20 }, { zoom: 1 })).toBe(
      'edge-1',
    )
    expect(
      findCanvasEdgeAtPoint(nodes, [createBezierEdge()], { x: 100, y: 70 }, { zoom: 1 }),
    ).toBeNull()
  })

  it('selects bezier edges through rectangle hit testing', () => {
    const edges = [
      createBezierEdge(),
      createBezierEdge({
        id: 'edge-2',
        source: 'target',
        target: 'source',
        sourceHandle: undefined,
        targetHandle: undefined,
      }),
    ]

    expect(
      getCanvasEdgesMatchingRectangle(
        nodes,
        edges,
        { x: 80, y: 10, width: 40, height: 20 },
        { zoom: 1 },
      ),
    ).toEqual(['edge-1', 'edge-2'])

    expect(
      getCanvasEdgesMatchingRectangle(
        nodes,
        [createBezierEdge()],
        { x: 80, y: 60, width: 40, height: 20 },
        { zoom: 1 },
      ),
    ).toEqual([])
  })

  it('selects only intersecting edges through lasso hit testing', () => {
    const crossingEdge = createBezierEdge({
      id: 'crossing-edge',
      source: 'source',
      target: 'target',
    })
    const outsideEdge = createBezierEdge({
      id: 'outside-edge',
      source: 'target',
      target: 'target-2',
    })
    const lassoNodes = [...nodes, createNode('target-2', 160, 120)]

    expect(
      getCanvasEdgesMatchingLasso(
        lassoNodes,
        [crossingEdge, outsideEdge],
        [
          { x: 60, y: 0 },
          { x: 120, y: 0 },
          { x: 120, y: 40 },
          { x: 60, y: 40 },
        ],
        { zoom: 1 },
      ),
    ).toEqual(['crossing-edge'])
  })
})
