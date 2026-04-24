import { describe, expect, it } from 'vitest'
import { createCanvasReorderPlan } from '../canvas-reorder-plan'
import { reorderCanvasElementIds } from '../canvas-reorder'
import { getNextCanvasElementZIndex } from '../canvas-z-index'
import { applyCanvasZOrder, sortCanvasElementsByZIndex } from '../canvas-z-order'
import type { Edge, Node } from '@xyflow/react'
import * as Y from 'yjs'

function createNode(id: string, zIndex: number): Node {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0 },
    data: {},
    zIndex,
  }
}

function createEdge(id: string, zIndex: number): Edge {
  return {
    id,
    type: 'bezier',
    source: `${id}-source`,
    target: `${id}-target`,
    zIndex,
  }
}

describe('canvas z-order helpers', () => {
  it('returns the base z-index when there are no elements', () => {
    expect(getNextCanvasElementZIndex([])).toBe(1)
    expect(sortCanvasElementsByZIndex([])).toEqual([])
  })

  it('sorts render order without renormalizing persisted zIndex values', () => {
    const elements = [
      { id: 'node-2', zIndex: 10 },
      { id: 'node-1', zIndex: 4 },
    ]

    expect(sortCanvasElementsByZIndex(elements)).toEqual([
      { id: 'node-1', zIndex: 4 },
      { id: 'node-2', zIndex: 10 },
    ])
  })

  it('preserves original order when multiple elements share the same z-index', () => {
    const elements = [
      { id: 'node-1', zIndex: 4 },
      { id: 'node-2', zIndex: 4 },
      { id: 'node-3', zIndex: 4 },
    ]

    expect(sortCanvasElementsByZIndex(elements).map((element) => element.id)).toEqual([
      'node-1',
      'node-2',
      'node-3',
    ])
  })

  it('allocates the next persisted zIndex above the highest existing value', () => {
    expect(
      getNextCanvasElementZIndex([
        { id: 'node-1', zIndex: 4 },
        { id: 'node-2', zIndex: 10 },
      ]),
    ).toBe(11)
  })

  it('reorders ids independently from zIndex assignment and applies normalized persisted order', () => {
    const elements = [
      { id: 'node-1', zIndex: 1 },
      { id: 'node-2', zIndex: 2 },
      { id: 'node-3', zIndex: 3 },
    ]

    const orderedIds = reorderCanvasElementIds(
      elements.map((element) => element.id),
      ['node-1'],
      'bringToFront',
    )

    expect(orderedIds).toEqual(['node-2', 'node-3', 'node-1'])
    expect(applyCanvasZOrder(elements, orderedIds)).toEqual([
      { id: 'node-2', zIndex: 1 },
      { id: 'node-3', zIndex: 2 },
      { id: 'node-1', zIndex: 3 },
    ])
  })

  it('returns no reorder plan for an empty selection', () => {
    const doc = new Y.Doc()
    try {
      const nodesMap = doc.getMap<Node>('nodes')
      const edgesMap = doc.getMap<Edge>('edges')

      expect(
        createCanvasReorderPlan(nodesMap, edgesMap, { nodeIds: [], edgeIds: [] }, 'bringToFront'),
      ).toBeNull()
    } finally {
      doc.destroy()
    }
  })

  it('builds a mixed reorder plan for selected nodes and edges', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    try {
      nodesMap.set('node-1', createNode('node-1', 1))
      nodesMap.set('node-2', createNode('node-2', 2))
      edgesMap.set('edge-1', createEdge('edge-1', 1))
      edgesMap.set('edge-2', createEdge('edge-2', 2))

      expect(
        createCanvasReorderPlan(
          nodesMap,
          edgesMap,
          { nodeIds: ['node-1'], edgeIds: ['edge-1'] },
          'bringToFront',
        ),
      ).toEqual({
        nodes: [createNode('node-2', 1), createNode('node-1', 2)],
        edges: [createEdge('edge-2', 1), createEdge('edge-1', 2)],
      })
    } finally {
      doc.destroy()
    }
  })
})
