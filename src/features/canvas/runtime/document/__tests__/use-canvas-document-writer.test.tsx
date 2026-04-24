import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createCanvasDocumentWriter } from '../use-canvas-document-writer'
import type { Edge, Node } from '@xyflow/react'
import type { CanvasEdgePatch } from '../../../edges/canvas-edge-types'

const validCanvasEdgePatch: CanvasEdgePatch = {
  type: 'step',
  style: { stroke: 'var(--t-blue)', strokeWidth: 4, opacity: 0.5 },
}
void validCanvasEdgePatch

// @ts-expect-error Canvas edge patches intentionally cannot rewrite connection endpoints.
const invalidCanvasEdgePatch: CanvasEdgePatch = { source: 'node-2' }
void invalidCanvasEdgePatch

function createTextNode(id: string): Node {
  return {
    id,
    type: 'text',
    position: { x: 10, y: 20 },
    width: 120,
    height: 36,
    data: { label: 'Hello' },
  }
}

function createStrokeNode(id: string): Node {
  return {
    id,
    type: 'stroke',
    position: { x: 0, y: 0 },
    width: 20,
    height: 10,
    data: {
      color: '#000',
      size: 4,
      opacity: 100,
      bounds: { x: 0, y: 0, width: 20, height: 10 },
      points: [
        [0, 0, 0.5],
        [10, 5, 0.5],
        [20, 10, 0.5],
      ],
    },
  }
}

describe('createCanvasDocumentWriter', () => {
  let doc: Y.Doc
  let nodesMap: Y.Map<Node>
  let edgesMap: Y.Map<Edge>

  beforeEach(() => {
    doc = new Y.Doc()
    nodesMap = doc.getMap<Node>('nodes')
    edgesMap = doc.getMap<Edge>('edges')
  })

  afterEach(() => {
    doc.destroy()
  })

  it('creates, updates, and deletes nodes and edges through Yjs transactions', () => {
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    writer.createNode(createTextNode('node-1'))
    writer.createNode(createTextNode('node-2'))
    writer.createEdge(
      {
        source: 'node-1',
        target: 'node-2',
        sourceHandle: null,
        targetHandle: null,
      },
      {
        type: 'step',
        style: {
          stroke: 'var(--t-red)',
          strokeWidth: 8,
          opacity: 0.5,
        },
      },
    )

    expect(nodesMap.get('node-1')).toMatchObject({
      type: 'text',
      data: { label: 'Hello' },
    })
    expect(Array.from(edgesMap.values())).toEqual([
      expect.objectContaining({
        source: 'node-1',
        target: 'node-2',
        sourceHandle: null,
        targetHandle: null,
        type: 'step',
        style: {
          stroke: 'var(--t-red)',
          strokeWidth: 8,
          opacity: 0.5,
        },
      }),
    ])

    writer.patchNodeData(new Map([['node-1', { label: 'Updated', color: 'red' }]]))
    writer.setNodePositions(new Map([['node-1', { x: 50, y: 60 }]]))

    expect(nodesMap.get('node-1')).toMatchObject({
      position: { x: 50, y: 60 },
      data: { label: 'Updated', color: 'red' },
    })

    const [edgeId] = Array.from(edgesMap.keys())
    writer.patchEdges(
      new Map([
        [
          edgeId,
          {
            style: { stroke: 'var(--t-blue)', strokeWidth: 4 },
          },
        ],
      ]),
    )

    expect(edgesMap.get(edgeId)).toMatchObject({
      style: { stroke: 'var(--t-blue)', strokeWidth: 4 },
    })

    writer.deleteEdges(new Set([edgeId]))
    writer.deleteNodes(new Set(['node-1']))

    expect(nodesMap.get('node-1')).toBeUndefined()
    expect(edgesMap.get(edgeId)).toBeUndefined()
  })

  it('applies stroke-aware resize behavior without mixing in selection state', () => {
    nodesMap.set('stroke-1', createStrokeNode('stroke-1'))
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    writer.resizeNode('stroke-1', 40, 20, { x: 5, y: 10 })

    const stroke = nodesMap.get('stroke-1')
    expect(stroke).toMatchObject({
      position: { x: 5, y: 10 },
      width: 40,
      height: 20,
    })
    expect(stroke?.data).toMatchObject({
      // Stroke bounds stay in local coordinates; the world position is stored on node.position.
      bounds: { x: 0, y: 0, width: 40, height: 20 },
    })
    expect(stroke?.selected).toBeUndefined()
  })

  it('applies batched node data, edge, and position updates in one writer call', () => {
    nodesMap.set('node-1', createTextNode('node-1'))
    nodesMap.set('node-2', createTextNode('node-2'))
    edgesMap.set('edge-1', {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      type: 'straight',
      style: { strokeWidth: 1 },
    })
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    writer.patchNodeData(
      new Map([
        ['node-1', { backgroundColor: 'red' }],
        ['node-2', { backgroundColor: 'blue' }],
      ]),
    )
    writer.patchEdges(
      new Map([
        [
          'edge-1',
          {
            style: { strokeWidth: 8 },
          },
        ],
      ]),
    )
    writer.setNodePositions(
      new Map([
        ['node-1', { x: 100, y: 200 }],
        ['node-2', { x: 300, y: 400 }],
      ]),
    )

    expect(nodesMap.get('node-1')).toMatchObject({
      data: { backgroundColor: 'red' },
      position: { x: 100, y: 200 },
    })
    expect(nodesMap.get('node-2')).toMatchObject({
      data: { backgroundColor: 'blue' },
      position: { x: 300, y: 400 },
    })
    expect(edgesMap.get('edge-1')).toMatchObject({
      style: { strokeWidth: 8 },
    })
  })

  it('does not transact empty batched updates', () => {
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })
    let nodeEvents = 0
    let edgeEvents = 0
    nodesMap.observe(() => {
      nodeEvents += 1
    })
    edgesMap.observe(() => {
      edgeEvents += 1
    })

    writer.patchNodeData(new Map())
    writer.patchEdges(new Map())
    writer.setNodePositions(new Map())

    expect(nodeEvents).toBe(0)
    expect(edgeEvents).toBe(0)
  })

  it('deletes edges connected to removed nodes in the same document change', () => {
    nodesMap.set('node-1', createTextNode('node-1'))
    nodesMap.set('node-2', createTextNode('node-2'))
    edgesMap.set('edge-1', {
      id: 'edge-1',
      type: 'bezier',
      source: 'node-1',
      target: 'node-2',
    })
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    writer.deleteNodes(new Set(['node-1']))

    expect(nodesMap.has('node-1')).toBe(false)
    expect(edgesMap.has('edge-1')).toBe(false)
  })

  it('throws when createNode is called with a duplicate node id', () => {
    nodesMap.set('node-1', createTextNode('node-1'))
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    expect(() => {
      writer.createNode(createTextNode('node-1'))
    }).toThrow('Canvas node "node-1" already exists')
  })

  it('no-ops when update paths target missing nodes or edges', () => {
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    writer.patchNodeData(new Map([['missing-node', { label: 'ignored' }]]))
    writer.resizeNode('missing-node', 50, 60, { x: 1, y: 2 })
    writer.setNodePositions(new Map([['missing-node', { x: 5, y: 6 }]]))
    writer.patchEdges(
      new Map([
        [
          'missing-edge',
          {
            type: 'step',
          },
        ],
      ]),
    )
    writer.deleteNodes(new Set(['missing-node', 'also-missing']))
    writer.deleteEdges(new Set(['missing-edge']))

    expect(Array.from(nodesMap.values())).toEqual([])
    expect(Array.from(edgesMap.values())).toEqual([])
  })
})
