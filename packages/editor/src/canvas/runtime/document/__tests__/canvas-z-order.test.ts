import { describe, expect, it } from 'vite-plus/test'
import { createCanvasReorderPlan } from '../canvas-reorder-plan'
import { reorderCanvasElementIds } from '../canvas-reorder'
import { getNextCanvasElementZIndex } from '../canvas-z-index'
import { sortCanvasElementsByZIndex } from '../canvas-z-order'
import * as Y from 'yjs'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'

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

  it('reorders ids independently from zIndex assignment', () => {
    const elements = [
      { id: 'node-1', zIndex: 1 },
      { id: 'node-2', zIndex: 2 },
      { id: 'node-3', zIndex: 3 },
    ]

    const orderedIds = reorderCanvasElementIds(
      elements.map((element) => element.id),
      new Set(['node-1']),
      'bringToFront',
    )

    expect(orderedIds).toEqual(['node-2', 'node-3', 'node-1'])
  })

  it('sends selected ids behind unselected ids', () => {
    expect(
      reorderCanvasElementIds(['node-1', 'node-2', 'node-3'], new Set(['node-3']), 'sendToBack'),
    ).toEqual(['node-3', 'node-1', 'node-2'])
  })

  it('moves selected ids one layer backward without crossing selected neighbors', () => {
    expect(
      reorderCanvasElementIds(
        ['node-1', 'node-2', 'node-3', 'node-4'],
        new Set(['node-3', 'node-4']),
        'sendBackward',
      ),
    ).toEqual(['node-1', 'node-3', 'node-4', 'node-2'])
  })

  it('moves selected ids one layer forward without crossing selected neighbors', () => {
    expect(
      reorderCanvasElementIds(
        ['node-1', 'node-2', 'node-3', 'node-4'],
        new Set(['node-1', 'node-2']),
        'bringForward',
      ),
    ).toEqual(['node-3', 'node-1', 'node-2', 'node-4'])
  })

  it('returns no reorder plan for an empty selection', () => {
    const doc = new Y.Doc()
    try {
      const nodesMap = doc.getMap<Node>('nodes')
      const edgesMap = doc.getMap<Edge>('edges')

      expect(
        createCanvasReorderPlan(
          nodesMap,
          edgesMap,
          { nodeIds: new Set<string>(), edgeIds: new Set<string>() },
          'bringToFront',
        ),
      ).toBeNull()
    } finally {
      doc.destroy()
    }
  })

  it('returns no reorder plan when the selected elements no longer exist', () => {
    const doc = new Y.Doc()
    try {
      const nodesMap = doc.getMap<Node>('nodes')
      const edgesMap = doc.getMap<Edge>('edges')
      nodesMap.set('node-1', createNode('node-1', 1))

      expect(
        createCanvasReorderPlan(
          nodesMap,
          edgesMap,
          { nodeIds: new Set(['deleted-node']), edgeIds: new Set(['deleted-edge']) },
          'bringToFront',
        ),
      ).toBeNull()
    } finally {
      doc.destroy()
    }
  })

  it('builds an edge-only reorder plan across nodes and edges', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    try {
      nodesMap.set('node-1', createNode('node-1', 1))
      nodesMap.set('node-2', createNode('node-2', 3))
      edgesMap.set('edge-1', createEdge('edge-1', 2))
      edgesMap.set('edge-2', createEdge('edge-2', 4))

      expect(
        createCanvasReorderPlan(
          nodesMap,
          edgesMap,
          { nodeIds: new Set<string>(), edgeIds: new Set(['edge-1']) },
          'bringToFront',
        ),
      ).toEqual({
        nodes: [createNode('node-1', 1), createNode('node-2', 2)],
        edges: [createEdge('edge-2', 3), createEdge('edge-1', 4)],
      })
    } finally {
      doc.destroy()
    }
  })
})
