import { describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import {
  applyCanvasPasteCommand,
  applyCanvasReorderCommand,
  createCanvasEdgeCommand,
  createCanvasNodeCommand,
  createCanvasNodeCommandUpdates,
  deleteCanvasEdgesCommand,
  deleteCanvasSelectionCommand,
  patchCanvasEdgesCommand,
  patchCanvasNodeDataCommand,
  resizeCanvasNodeCommand,
  resizeCanvasNodesCommand,
  setCanvasNodePositionsCommand,
} from '../canvas-document-commands'
import type { CanvasSelectionSnapshot } from '../../../system/canvas-selection'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'

function createNode(id: string): Node {
  return {
    id,
    type: 'text',
    position: { x: 10, y: 20 },
    width: 120,
    height: 40,
    data: {},
  }
}

function createEdge(id: string): Edge {
  return {
    id,
    source: 'node-1',
    target: 'node-2',
    type: 'straight',
  }
}

function createStyledEdge(id: string, strokeWidth: number): Edge {
  return {
    ...createEdge(id),
    style: { strokeWidth },
  }
}

function createStrokeNode(id: string): Extract<Node, { type: 'stroke' }> {
  return {
    id,
    type: 'stroke',
    position: { x: 0, y: 0 },
    width: 20,
    height: 10,
    data: {
      bounds: { x: 0, y: 0, width: 20, height: 10 },
      color: '#000',
      opacity: 100,
      points: [
        [0, 0, 0.5],
        [20, 10, 0.5],
      ],
      size: 4,
    },
  }
}

function createEmbedNode(id: string): Extract<Node, { type: 'embed' }> {
  return {
    id,
    type: 'embed',
    position: { x: 0, y: 0 },
    width: 320,
    height: 240,
    data: {
      target: { kind: 'empty' },
      lockedAspectRatio: 2,
    },
  }
}

function createCanvasMaps() {
  const doc = new Y.Doc()
  const nodesMap = doc.getMap<Node>('nodes')
  const edgesMap = doc.getMap<Edge>('edges')

  return { doc, nodesMap, edgesMap }
}

function selectionSnapshot(
  nodeIds: ReadonlySet<string> = new Set<string>(),
  edgeIds: ReadonlySet<string> = new Set<string>(),
): CanvasSelectionSnapshot {
  return { nodeIds, edgeIds }
}

describe('canvas document commands', () => {
  it('creates nodes with validated z-indexes and rejects duplicate ids', () => {
    const { doc, nodesMap } = createCanvasMaps()

    createCanvasNodeCommand({
      nodesMap,
      node: createNode('node-1'),
      sanitizeNode: (node) => node,
      nextZIndex: 7,
    })

    expect(nodesMap.get('node-1')?.zIndex).toBe(7)
    expect(() =>
      createCanvasNodeCommand({
        nodesMap,
        node: createNode('node-1'),
        sanitizeNode: (node) => node,
        nextZIndex: 8,
      }),
    ).toThrow('Canvas node "node-1" already exists')
    expect(() =>
      createCanvasNodeCommandUpdates({
        nodesMap,
        nodes: [createNode('node-2'), createNode('node-2')],
        sanitizeNode: (node) => node,
        nextZIndex: 8,
        operation: 'createNodes',
      }),
    ).toThrow('Canvas node "node-2" already exists')
    doc.destroy()
  })

  it('patches node data by node type and preserves embed unset sentinels', () => {
    const { doc, nodesMap } = createCanvasMaps()
    nodesMap.set('text-1', createNode('text-1'))
    nodesMap.set('stroke-1', createStrokeNode('stroke-1'))
    nodesMap.set('embed-1', createEmbedNode('embed-1'))

    patchCanvasNodeDataCommand({
      nodesMap,
      updates: new Map([
        ['text-1', { backgroundColor: 'red' }],
        ['stroke-1', { color: '#f00' }],
        ['embed-1', { target: { kind: 'empty' }, lockedAspectRatio: null }],
      ]),
      sanitizeNode: (node) => node,
    })

    expect(nodesMap.get('text-1')?.data).toMatchObject({ backgroundColor: 'red' })
    expect(nodesMap.get('stroke-1')?.data).toMatchObject({ color: '#f00' })
    expect(nodesMap.get('embed-1')?.data).toEqual({ target: { kind: 'empty' } })
    doc.destroy()
  })

  it('throws for unhandled node types when patching node data', () => {
    const { doc, nodesMap } = createCanvasMaps()
    nodesMap.set('bad-1', { ...createNode('bad-1'), type: 'unknown' } as unknown as Node)

    expect(() =>
      patchCanvasNodeDataCommand({
        nodesMap,
        updates: new Map([['bad-1', { backgroundColor: 'red' }]]),
        sanitizeNode: (node) => node,
      }),
    ).toThrow('Unhandled canvas node type in patchNodeData: unknown')
    doc.destroy()
  })

  it('patches, creates, and deletes edges through command helpers', () => {
    const { doc, edgesMap } = createCanvasMaps()
    edgesMap.set('edge-1', createStyledEdge('edge-1', 2))

    patchCanvasEdgesCommand({
      edgesMap,
      updates: new Map([['edge-1', { style: { strokeWidth: 0 } }]]),
    })
    createCanvasEdgeCommand({
      edgesMap,
      connection: {
        source: 'node-1',
        target: 'node-2',
        sourceHandle: null,
        targetHandle: null,
      },
      defaults: { type: 'step', style: { strokeWidth: 3 } },
      nextZIndex: 9,
    })

    expect(edgesMap.get('edge-1')?.style).toMatchObject({ strokeWidth: 1 })
    const createdEdge = Array.from(edgesMap.values()).find((edge) => edge.id !== 'edge-1')
    expect(createdEdge).toMatchObject({ type: 'step', style: { strokeWidth: 3 }, zIndex: 9 })

    deleteCanvasEdgesCommand({ edgesMap, edgeIds: new Set(['edge-1']) })

    expect(edgesMap.has('edge-1')).toBe(false)
    doc.destroy()
  })

  it('resizes nodes and deletes the selected graph through command helpers', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    nodesMap.set('node-1', createNode('node-1'))
    nodesMap.set('node-2', createNode('node-2'))
    edgesMap.set('edge-1', createEdge('edge-1'))

    resizeCanvasNodeCommand({
      nodesMap,
      nodeId: 'node-1',
      width: 200,
      height: 80,
      position: { x: 30, y: 40 },
      sanitizeNode: (node) => node,
    })
    resizeCanvasNodesCommand({
      nodesMap,
      updates: new Map([['node-2', { width: 140, height: 60, position: { x: 50, y: 60 } }]]),
      sanitizeNode: (node) => node,
    })

    expect(nodesMap.get('node-1')).toMatchObject({
      position: { x: 30, y: 40 },
      width: 200,
      height: 80,
    })
    expect(nodesMap.get('node-2')).toMatchObject({
      position: { x: 50, y: 60 },
      width: 140,
      height: 60,
    })

    expect(
      deleteCanvasSelectionCommand({
        nodesMap,
        edgesMap,
        selection: selectionSnapshot(new Set(['node-1']), new Set()),
      }),
    ).toEqual({ nodeCount: 1, edgeCount: 1 })
    expect(nodesMap.has('node-1')).toBe(false)
    expect(edgesMap.has('edge-1')).toBe(false)
    doc.destroy()
  })

  it('validates pasted nodes before writing any pasted content', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const onApplied = vi.fn()

    expect(() =>
      applyCanvasPasteCommand({
        nodesMap,
        edgesMap,
        paste: {
          nodes: [createNode('node-1'), createNode('node-2')],
          edges: [createEdge('edge-1')],
          selection: selectionSnapshot(new Set(['node-1', 'node-2']), new Set(['edge-1'])),
        },
        sanitizeNode: (node) => {
          if (node.id === 'node-2') {
            throw new Error('invalid node')
          }
          return node
        },
        onApplied,
      }),
    ).toThrow('invalid node')

    expect(Array.from(nodesMap.keys())).toEqual([])
    expect(Array.from(edgesMap.keys())).toEqual([])
    expect(onApplied).not.toHaveBeenCalled()
    doc.destroy()
  })

  it('normalizes pasted edge styles before writing them', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()

    applyCanvasPasteCommand({
      nodesMap,
      edgesMap,
      paste: {
        nodes: [createNode('node-1'), createNode('node-2')],
        edges: [createStyledEdge('edge-1', 0)],
        selection: selectionSnapshot(new Set(['node-1', 'node-2']), new Set(['edge-1'])),
      },
      sanitizeNode: (node) => node,
    })

    expect(edgesMap.get('edge-1')?.style).toMatchObject({ strokeWidth: 1 })
    doc.destroy()
  })

  it('validates multi-node position updates before writing any node updates', () => {
    const { doc, nodesMap } = createCanvasMaps()
    nodesMap.set('node-1', createNode('node-1'))
    nodesMap.set('node-2', createNode('node-2'))

    expect(() =>
      setCanvasNodePositionsCommand({
        nodesMap,
        positions: new Map([
          ['node-1', { x: 100, y: 100 }],
          ['node-2', { x: 200, y: 200 }],
        ]),
        sanitizeNode: (node) => {
          if (node.id === 'node-2') {
            throw new Error('invalid node')
          }
          return node
        },
      }),
    ).toThrow('invalid node')

    expect(nodesMap.get('node-1')?.position).toEqual({ x: 10, y: 20 })
    expect(nodesMap.get('node-2')?.position).toEqual({ x: 10, y: 20 })
    doc.destroy()
  })

  it('skips reordered nodes and edges that were concurrently deleted', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    nodesMap.set('node-1', createNode('node-1'))
    edgesMap.set('edge-1', createEdge('edge-1'))

    applyCanvasReorderCommand({
      nodesMap,
      edgesMap,
      reorderUpdates: {
        nodes: [
          { ...createNode('node-1'), zIndex: 10 },
          { ...createNode('node-2'), zIndex: 20 },
        ],
        edges: [
          { ...createEdge('edge-1'), zIndex: 30 },
          { ...createEdge('edge-2'), zIndex: 40 },
        ],
      },
    })

    expect(nodesMap.get('node-1')?.zIndex).toBe(10)
    expect(nodesMap.has('node-2')).toBe(false)
    expect(edgesMap.get('edge-1')?.zIndex).toBe(30)
    expect(edgesMap.has('edge-2')).toBe(false)
    doc.destroy()
  })
})
