import { describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { CanvasDocumentController } from '../document-controller'
import {
  canonicalizeCanvasDocumentContent,
  createCanvasDocumentDoc,
  getCanvasDocumentMaps,
  parseCanvasDocumentContent,
} from '../document-contract'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../document-contract'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')
const NODE_C = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-333333333333')

function textNode(id: typeof NODE_A, x = 0): CanvasDocumentNode {
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
  const controller = new CanvasDocumentController(document)
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

  it('validates every replacement before changing any node', () => {
    const { controller, document } = createController({
      nodes: [textNode(NODE_A), textNode(NODE_B)],
    })

    expect(() =>
      controller.apply({
        type: 'replace',
        edges: [],
        nodes: [
          textNode(NODE_A, 10),
          { ...textNode(NODE_B, 20), position: { x: Number.NaN, y: 0 } },
        ],
      }),
    ).toThrow('invalid node')
    expect(controller.read().nodes).toEqual([textNode(NODE_A), textNode(NODE_B)])
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

    document.transact(() => nodesMap.set(NODE_B, textNode(NODE_B)), 'remote')
    expect(controller.undo()).toBe(true)
    expect(controller.read()).toEqual({ nodes: [textNode(NODE_B)], edges: [] })
    expect(controller.canUndo).toBe(false)
    controller.dispose()
    document.destroy()
  })

  it('keeps undo valid after canonicalizing a concurrent dangling edge', () => {
    const base = createCanvasDocumentDoc({
      nodes: [textNode(NODE_A), textNode(NODE_B)],
      edges: [],
    })
    const baseUpdate = Y.encodeStateAsUpdate(base)
    const document = new Y.Doc()
    Y.applyUpdate(document, baseUpdate)
    const controller = new CanvasDocumentController(document)
    const remote = new Y.Doc()
    Y.applyUpdate(remote, baseUpdate)
    const remoteVector = Y.encodeStateVector(remote)
    getCanvasDocumentMaps(remote).edgesMap.set('edge-a-b', edge('edge-a-b'))
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
      type: 'replace',
      nodes: [{ ...textNode(NODE_A), hidden: true }],
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
  it('rejects map keys that differ from their canonical element IDs', () => {
    const document = new Y.Doc()
    const { edgesMap, nodesMap } = getCanvasDocumentMaps(document)
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
