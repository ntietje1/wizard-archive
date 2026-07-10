import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import * as Y from 'yjs'
import { createCanvasDocumentWriter } from '../use-canvas-document-writer'
import type { CanvasEdgePatch } from '../../../edges/canvas-edge-types'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'

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
    data: { content: [{ type: 'paragraph' }] },
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

function createLegacyEmbedNode(id: string): Extract<Node, { type: 'embed' }> {
  return {
    id,
    type: 'embed',
    position: { x: 0, y: 0 },
    width: 320,
    height: 240,
    data: { sidebarItemId: 'old-item' } as never,
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
      data: { content: [{ type: 'paragraph' }] },
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

    writer.patchNodeData(new Map([['node-1', { backgroundColor: 'red' }]]))
    writer.setNodePositions(new Map([['node-1', { x: 50, y: 60 }]]))

    expect(nodesMap.get('node-1')).toMatchObject({
      position: { x: 50, y: 60 },
      data: { backgroundColor: 'red' },
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
  })

  it('resizes multiple nodes in one writer call', () => {
    nodesMap.set('node-1', createTextNode('node-1'))
    nodesMap.set('stroke-1', createStrokeNode('stroke-1'))
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    writer.resizeNodes(
      new Map([
        ['node-1', { width: 120, height: 60, position: { x: 10, y: 20 } }],
        ['stroke-1', { width: 40, height: 20, position: { x: 50, y: 60 } }],
      ]),
    )

    expect(nodesMap.get('node-1')).toMatchObject({
      position: { x: 10, y: 20 },
      width: 120,
      height: 60,
    })
    expect(nodesMap.get('stroke-1')).toMatchObject({
      position: { x: 50, y: 60 },
      width: 40,
      height: 20,
      data: {
        bounds: { x: 0, y: 0, width: 40, height: 20 },
      },
    })
  })

  it('creates multiple nodes in one Yjs transaction', () => {
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })
    let nodeEvents = 0
    nodesMap.observe((_event) => {
      nodeEvents += 1
    })

    writer.createNodes([createTextNode('node-1'), createTextNode('node-2')])

    expect(nodesMap.has('node-1')).toBe(true)
    expect(nodesMap.has('node-2')).toBe(true)
    expect(nodesMap.get('node-1')?.zIndex).toBe(1)
    expect(nodesMap.get('node-2')?.zIndex).toBe(2)
    expect(nodeEvents).toBe(1)
  })

  it('validates batched node creation before writing any node', () => {
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    expect(() => {
      writer.createNodes([createTextNode('node-1'), createTextNode('node-1')])
    }).toThrow('Canvas node "node-1" already exists')

    expect(Array.from(nodesMap.keys())).toEqual([])
  })

  it('rejects mixed document maps when creating a writer', () => {
    const otherDoc = new Y.Doc()
    try {
      expect(() =>
        createCanvasDocumentWriter({
          nodesMap,
          edgesMap: otherDoc.getMap<Edge>('edges'),
        }),
      ).toThrow('createCanvasDocumentWriter requires nodesMap.doc and edgesMap.doc to match')
    } finally {
      otherDoc.destroy()
    }
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

  it('removes legacy embed sidebarItemId when patching a canonical target', () => {
    nodesMap.set('embed-1', createLegacyEmbedNode('embed-1'))
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    writer.patchNodeData(
      new Map([
        [
          'embed-1',
          {
            target: {
              kind: 'externalUrl',
              url: 'https://example.com/file.pdf',
              name: 'file.pdf',
            },
          },
        ],
      ]),
    )

    expect(nodesMap.get('embed-1')?.data).toEqual({
      target: {
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      },
    })
  })

  it('removes embed locked aspect ratio when patching null', () => {
    nodesMap.set('embed-1', {
      ...createLegacyEmbedNode('embed-1'),
      data: { target: { kind: 'empty' }, lockedAspectRatio: 2 },
    })
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    writer.patchNodeData(new Map([['embed-1', { lockedAspectRatio: null }]]))

    expect(nodesMap.get('embed-1')?.data).toEqual({ target: { kind: 'empty' } })
  })

  it('clamps edge stroke widths to one when creating and patching edges', () => {
    nodesMap.set('node-1', createTextNode('node-1'))
    nodesMap.set('node-2', createTextNode('node-2'))
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    writer.createEdge(
      {
        source: 'node-1',
        target: 'node-2',
      },
      {
        type: 'bezier',
        style: { strokeWidth: 0 },
      },
    )

    const [edgeId] = Array.from(edgesMap.keys())
    expect(edgesMap.get(edgeId)?.style).toMatchObject({ strokeWidth: 1 })

    writer.patchEdges(new Map([[edgeId, { style: { strokeWidth: -4 } }]]))

    expect(edgesMap.get(edgeId)?.style).toMatchObject({ strokeWidth: 1 })
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
    writer.resizeNodes(new Map())
    writer.setNodePositions(new Map())

    expect(nodeEvents).toBe(0)
    expect(edgeEvents).toBe(0)
  })

  it('returns explicit command outcomes for readonly, empty, missing, completed, and failed writes', () => {
    const readonlyWriter = createCanvasDocumentWriter({ canEdit: false, nodesMap, edgesMap })

    expect(
      readonlyWriter.execute({ type: 'createNode', node: createTextNode('created-node') }),
    ).toEqual({
      type: 'rejected',
      command: 'createNode',
      reason: 'readonly',
    })

    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    expect(writer.execute({ type: 'patchNodeData', updates: new Map() })).toEqual({
      type: 'skipped',
      command: 'patchNodeData',
      reason: 'empty',
    })
    expect(
      writer.execute({
        type: 'patchNodeData',
        updates: new Map([['missing-node', { backgroundColor: 'ignored' }]]),
      }),
    ).toEqual({
      type: 'skipped',
      command: 'patchNodeData',
      reason: 'unavailable-target',
    })

    nodesMap.set('node-1', createTextNode('node-1'))

    expect(
      writer.execute({
        type: 'patchNodeData',
        updates: new Map([['node-1', { backgroundColor: 'red' }]]),
      }),
    ).toEqual({
      type: 'completed',
      command: 'patchNodeData',
      affectedCount: 1,
    })
    expect(writer.execute({ type: 'createNode', node: createTextNode('node-1') })).toEqual({
      type: 'failed',
      command: 'createNode',
      reason: 'duplicate-id',
      error: expect.any(Error),
    })
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

    expect(writer.execute({ type: 'deleteNodes', nodeIds: new Set(['node-1']) })).toEqual({
      type: 'completed',
      command: 'deleteNodes',
      affectedCount: 2,
    })

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

  it('does not mutate the document when created for a read-only runtime', () => {
    nodesMap.set('node-1', createTextNode('node-1'))
    nodesMap.set('node-2', createTextNode('node-2'))
    edgesMap.set('edge-1', {
      id: 'edge-1',
      type: 'bezier',
      source: 'node-1',
      target: 'node-2',
    })
    const writer = createCanvasDocumentWriter({ canEdit: false, nodesMap, edgesMap })

    writer.createNode(createTextNode('created-node'))
    writer.createNodes([createTextNode('created-node-2')])
    writer.patchNodeData(new Map([['node-1', { backgroundColor: 'red' }]]))
    writer.resizeNode('node-1', 50, 60, { x: 1, y: 2 })
    writer.resizeNodes(new Map([['node-1', { width: 40, height: 30, position: { x: 5, y: 6 } }]]))
    writer.setNodePositions(new Map([['node-1', { x: 8, y: 9 }]]))
    writer.patchEdges(new Map([['edge-1', { type: 'step' }]]))
    writer.createEdge({ source: 'node-1', target: 'node-2' })
    writer.deleteNodes(new Set(['node-1']))
    writer.deleteEdges(new Set(['edge-1']))

    expect(Array.from(nodesMap.values())).toEqual([
      createTextNode('node-1'),
      createTextNode('node-2'),
    ])
    expect(Array.from(edgesMap.values())).toEqual([
      {
        id: 'edge-1',
        type: 'bezier',
        source: 'node-1',
        target: 'node-2',
      },
    ])
  })

  it('no-ops when update paths target missing nodes or edges', () => {
    const writer = createCanvasDocumentWriter({ nodesMap, edgesMap })

    writer.patchNodeData(new Map([['missing-node', { backgroundColor: 'ignored' }]]))
    writer.resizeNode('missing-node', 50, 60, { x: 1, y: 2 })
    writer.resizeNodes(
      new Map([['missing-node', { width: 50, height: 60, position: { x: 1, y: 2 } }]]),
    )
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
