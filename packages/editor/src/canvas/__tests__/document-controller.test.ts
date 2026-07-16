import { describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { createCanvasDocumentController } from '../document-controller'
import type { CanvasDocumentChange } from '../document-controller'
import {
  canonicalizeCanvasDocumentContent,
  createCanvasDocumentDoc,
  parseCanvasDocumentContent,
} from '../document-contract'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
  CanvasTextDocumentNode,
} from '../document-contract'
import { createCanvasEdgeMap, createCanvasNodeMap, getCanvasDocumentMaps } from '../document-crdt'
import { createCanvasTextDocument } from '../text/model'
import { CANVAS_WORKLOAD_LIMITS } from '../workload'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')
const NODE_C = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-333333333333')

function textNode(id: typeof NODE_A, x = 0): CanvasTextDocumentNode {
  return { id, type: 'text', position: { x, y: 0 }, data: {} }
}

function edge(id: string, source = NODE_A, target = NODE_B): CanvasDocumentEdge {
  return { id, source, target, type: 'straight' }
}

function createController(
  content: {
    nodes?: ReadonlyArray<CanvasDocumentNode>
    edges?: ReadonlyArray<CanvasDocumentEdge>
  } = {},
) {
  const document = createCanvasDocumentDoc({
    nodes: content.nodes ?? [],
    edges: content.edges ?? [],
  })
  const controller = createCanvasDocumentController(document)
  return { controller, document, ...getCanvasDocumentMaps(document) }
}

describe('CanvasDocumentController', () => {
  it('inserts nodes and edges atomically with deterministic z-indexes', () => {
    const { controller, document } = createController()

    expect(
      controller.apply({
        type: 'insert',
        nodes: [textNode(NODE_A), textNode(NODE_B)],
        edges: [edge('edge-a-b')],
      }),
    ).toEqual({ nodesChanged: 2, edgesChanged: 1 })

    expect(controller.read()).toEqual({
      nodes: [
        { ...textNode(NODE_A), zIndex: 1 },
        { ...textNode(NODE_B), zIndex: 2 },
      ],
      edges: [{ ...edge('edge-a-b'), zIndex: 3 }],
    })
    controller.dispose()
    document.destroy()
  })

  it('validates every insert before changing the document', () => {
    const { controller, document } = createController()

    expect(() =>
      controller.apply({
        type: 'insert',
        nodes: [textNode(NODE_A)],
        edges: [edge('missing-target', NODE_A, NODE_B)],
      }),
    ).toThrow('missing endpoint')
    expect(controller.read()).toEqual({ nodes: [], edges: [] })
    expect(controller.canUndo).toBe(false)
    controller.dispose()
    document.destroy()
  })

  it('validates every update before changing any node', () => {
    const { controller, document } = createController({
      nodes: [textNode(NODE_A), textNode(NODE_B)],
    })

    expect(() =>
      controller.apply({
        type: 'update',
        edges: [],
        nodes: [
          { id: NODE_A, type: 'text', position: { x: 10, y: 0 } },
          { id: NODE_B, type: 'text', position: { x: Number.NaN, y: 0 } },
        ],
      }),
    ).toThrow('invalid node')
    expect(controller.read().nodes).toEqual([textNode(NODE_A), textNode(NODE_B)])
    controller.dispose()
    document.destroy()
  })

  it('rejects an oversized text update before changing the document', () => {
    const { controller, document } = createController({ nodes: [textNode(NODE_A)] })

    expect(() =>
      controller.apply({
        type: 'update',
        nodes: [
          {
            id: NODE_A,
            type: 'text',
            data: {
              content: createCanvasTextDocument(
                'x'.repeat(CANVAS_WORKLOAD_LIMITS.textCharactersPerNode + 1),
              ),
            },
          },
        ],
        edges: [],
      }),
    ).toThrow('invalid node update')
    expect(controller.read().nodes).toEqual([textNode(NODE_A)])
    expect(controller.canUndo).toBe(false)
    controller.dispose()
    document.destroy()
  })

  it('removes connected edges with their node and restores both in one undo step', () => {
    const { controller, document } = createController({
      nodes: [textNode(NODE_A), textNode(NODE_B)],
      edges: [edge('edge-a-b')],
    })

    expect(controller.apply({ type: 'remove', nodeIds: [NODE_A], edgeIds: [] })).toEqual({
      nodesChanged: 1,
      edgesChanged: 1,
    })
    expect(controller.read()).toEqual({ nodes: [textNode(NODE_B)], edges: [] })

    expect(controller.undo()).toBe(true)
    expect(controller.read()).toEqual({
      nodes: [textNode(NODE_A), textNode(NODE_B)],
      edges: [edge('edge-a-b')],
    })
    expect(controller.redo()).toBe(true)
    expect(controller.read()).toEqual({ nodes: [textNode(NODE_B)], edges: [] })
    controller.dispose()
    document.destroy()
  })

  it('keeps remote changes outside local undo history', () => {
    const { controller, document, nodesMap } = createController()
    controller.apply({ type: 'insert', nodes: [textNode(NODE_A)], edges: [] })

    document.transact(() => nodesMap.set(NODE_B, createCanvasNodeMap(textNode(NODE_B))), 'remote')
    expect(controller.undo()).toBe(true)
    expect(controller.read()).toEqual({ nodes: [textNode(NODE_B)], edges: [] })
    expect(controller.canUndo).toBe(false)
    controller.dispose()
    document.destroy()
  })

  it('preserves concurrent geometry, content, style, and layer field intents in both orders', () => {
    const base = createCanvasDocumentDoc({
      nodes: [
        {
          ...textNode(NODE_A),
          width: 100,
          height: 50,
          zIndex: 1,
          data: { content: createCanvasTextDocument('Original'), backgroundColor: '#ffffff' },
        },
        { ...textNode(NODE_B), zIndex: 2, data: { content: createCanvasTextDocument('Second') } },
      ],
      edges: [],
    })
    const baseUpdate = Y.encodeStateAsUpdate(base)
    const operation = (change: CanvasDocumentChange) => {
      const document = new Y.Doc()
      Y.applyUpdate(document, baseUpdate)
      const vector = Y.encodeStateVector(document)
      const controller = createCanvasDocumentController(document)
      controller.apply(change)
      controller.dispose()
      const update = Y.encodeStateAsUpdate(document, vector)
      document.destroy()
      return update
    }
    const geometryAndOrder = operation({
      type: 'update',
      nodes: [
        {
          id: NODE_A,
          type: 'text',
          position: { x: 40, y: 60 },
          width: 240,
          height: 120,
          zIndex: 2,
        },
        { id: NODE_B, type: 'text', zIndex: 1 },
      ],
      edges: [],
    })
    const editedContent = createCanvasTextDocument('Edited')
    const alsoEditedContent = createCanvasTextDocument('Also edited')
    const contentAndStyle = operation({
      type: 'update',
      nodes: [
        {
          id: NODE_A,
          type: 'text',
          data: {
            content: editedContent,
            backgroundColor: '#ff0000',
            borderWidth: 3,
          },
        },
        {
          id: NODE_B,
          type: 'text',
          data: { content: alsoEditedContent },
        },
      ],
      edges: [],
    })

    for (const updates of [
      [geometryAndOrder, contentAndStyle],
      [contentAndStyle, geometryAndOrder],
    ]) {
      const merged = new Y.Doc()
      Y.applyUpdate(merged, baseUpdate)
      updates.forEach((update) => Y.applyUpdate(merged, update))
      expect(parseCanvasDocumentContent(merged)).toEqual({
        nodes: [
          {
            ...textNode(NODE_A),
            position: { x: 40, y: 60 },
            width: 240,
            height: 120,
            zIndex: 2,
            data: {
              content: editedContent,
              backgroundColor: '#ff0000',
              borderWidth: 3,
            },
          },
          {
            ...textNode(NODE_B),
            zIndex: 1,
            data: { content: alsoEditedContent },
          },
        ],
        edges: [],
      })
      merged.destroy()
    }
    base.destroy()
  })

  it('undoes local geometry without reverting a concurrent remote style field', () => {
    const base = createCanvasDocumentDoc({
      nodes: [
        {
          ...textNode(NODE_A),
          data: { backgroundColor: '#ffffff' },
        },
      ],
      edges: [],
    })
    const baseUpdate = Y.encodeStateAsUpdate(base)
    const document = new Y.Doc()
    Y.applyUpdate(document, baseUpdate)
    const controller = createCanvasDocumentController(document)
    controller.apply({
      type: 'update',
      nodes: [{ id: NODE_A, type: 'text', position: { x: 50, y: 25 } }],
      edges: [],
    })
    const remote = new Y.Doc()
    Y.applyUpdate(remote, baseUpdate)
    const vector = Y.encodeStateVector(remote)
    const remoteController = createCanvasDocumentController(remote)
    remoteController.apply({
      type: 'update',
      nodes: [{ id: NODE_A, type: 'text', data: { backgroundColor: '#ff0000' } }],
      edges: [],
    })
    remoteController.dispose()
    Y.applyUpdate(document, Y.encodeStateAsUpdate(remote, vector), 'remote')
    expect(controller.read().nodes[0]).toMatchObject({
      position: { x: 50, y: 25 },
      data: { backgroundColor: '#ff0000' },
    })

    expect(controller.undo()).toBe(true)
    expect(controller.read().nodes[0]).toMatchObject({
      position: { x: 0, y: 0 },
      data: { backgroundColor: '#ff0000' },
    })
    controller.dispose()
    document.destroy()
    remote.destroy()
    base.destroy()
  })

  it('keeps undo valid after canonicalizing a concurrent dangling edge', () => {
    const base = createCanvasDocumentDoc({
      nodes: [textNode(NODE_A), textNode(NODE_B)],
      edges: [],
    })
    const baseUpdate = Y.encodeStateAsUpdate(base)
    const document = new Y.Doc()
    Y.applyUpdate(document, baseUpdate)
    const controller = createCanvasDocumentController(document)
    const remote = new Y.Doc()
    Y.applyUpdate(remote, baseUpdate)
    const remoteVector = Y.encodeStateVector(remote)
    getCanvasDocumentMaps(remote).edgesMap.set('edge-a-b', createCanvasEdgeMap(edge('edge-a-b')))
    const remoteEdge = Y.encodeStateAsUpdate(remote, remoteVector)

    controller.apply({ type: 'remove', nodeIds: [NODE_A], edgeIds: [] })
    Y.applyUpdate(document, remoteEdge, 'remote')
    expect(parseCanvasDocumentContent(document)).toBeNull()
    expect(canonicalizeCanvasDocumentContent(document, 'remote')).toEqual({
      nodes: [textNode(NODE_B)],
      edges: [],
    })
    expect(controller.read()).toEqual({ nodes: [textNode(NODE_B)], edges: [] })

    expect(controller.undo()).toBe(true)
    expect(controller.read()).toEqual({
      nodes: [textNode(NODE_A), textNode(NODE_B)],
      edges: [],
    })
    controller.dispose()
    remote.destroy()
    document.destroy()
    base.destroy()
  })

  it('keeps redos separate and clears redo when a new local change is applied', () => {
    const { controller, document } = createController()
    controller.apply({ type: 'insert', nodes: [textNode(NODE_A)], edges: [] })
    controller.apply({ type: 'insert', nodes: [textNode(NODE_B)], edges: [] })
    controller.apply({ type: 'insert', nodes: [textNode(NODE_C)], edges: [] })

    controller.undo()
    controller.undo()
    controller.redo()
    expect(controller.read().nodes.map((node) => node.id)).toEqual([NODE_A, NODE_B])

    controller.apply({
      type: 'update',
      nodes: [{ id: NODE_A, type: 'text', hidden: true }],
      edges: [],
    })
    expect(controller.canRedo).toBe(false)
    controller.undo()
    expect(controller.read().nodes.map((node) => node.id)).toEqual([NODE_A, NODE_B])
    controller.undo()
    expect(controller.read().nodes.map((node) => node.id)).toEqual([NODE_A])
    controller.dispose()
    document.destroy()
  })

  it('publishes document and history changes without mirroring either state', () => {
    const { controller, document } = createController()
    const changed = vi.fn()
    const historyChanged = vi.fn()
    const unsubscribe = controller.subscribe(changed)
    const unsubscribeHistory = controller.subscribeHistory(historyChanged)

    controller.apply({ type: 'insert', nodes: [textNode(NODE_A)], edges: [] })
    controller.undo()
    expect(changed).toHaveBeenCalledTimes(2)
    expect(historyChanged).toHaveBeenCalledTimes(2)

    unsubscribe()
    unsubscribeHistory()
    controller.dispose()
    document.destroy()
  })
})

describe('canvas document identity', () => {
  it('derives identity from canonical map keys and rejects whole-object storage', () => {
    const document = new Y.Doc()
    const nodesMap = document.getMap<unknown>('nodes')
    const edgesMap = document.getMap<unknown>('edges')
    nodesMap.set(NODE_B, textNode(NODE_A))
    expect(parseCanvasDocumentContent(document)).toBeNull()

    nodesMap.clear()
    nodesMap.set(NODE_A, textNode(NODE_A))
    nodesMap.set(NODE_B, textNode(NODE_B))
    edgesMap.set('wrong-key', edge('edge-a-b'))
    expect(parseCanvasDocumentContent(document)).toBeNull()
    document.destroy()
  })
})
