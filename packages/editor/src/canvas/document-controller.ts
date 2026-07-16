import * as Y from 'yjs'
import {
  getCanvasDocumentMaps,
  parseCanvasDocumentContent,
  parseCanvasDocumentEdge,
  parseCanvasDocumentNode,
} from './document-contract'
import type {
  CanvasDocumentContent,
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from './document-contract'
import { assertDomainId, DOMAIN_ID_KIND } from '../resources/domain-id'
import type { CanvasNodeId } from '../resources/domain-id'

export type CanvasDocumentChange =
  | Readonly<{
      type: 'insert'
      nodes: ReadonlyArray<CanvasDocumentNode>
      edges: ReadonlyArray<CanvasDocumentEdge>
    }>
  | Readonly<{
      type: 'replace'
      nodes: ReadonlyArray<CanvasDocumentNode>
      edges: ReadonlyArray<CanvasDocumentEdge>
    }>
  | Readonly<{
      type: 'remove'
      nodeIds: ReadonlyArray<CanvasNodeId>
      edgeIds: ReadonlyArray<string>
    }>

export type CanvasDocumentChangeReceipt = Readonly<{
  nodesChanged: number
  edgesChanged: number
}>

const NO_DOCUMENT_CHANGES: CanvasDocumentChangeReceipt = Object.freeze({
  nodesChanged: 0,
  edgesChanged: 0,
})

function parseNodes(nodes: ReadonlyArray<CanvasDocumentNode>): Array<CanvasDocumentNode> {
  const parsed = nodes.map(parseCanvasDocumentNode)
  if (parsed.some((node) => node === null)) {
    throw new TypeError('Canvas document change contains an invalid node')
  }
  return parsed as Array<CanvasDocumentNode>
}

function parseEdges(edges: ReadonlyArray<CanvasDocumentEdge>): Array<CanvasDocumentEdge> {
  const parsed = edges.map(parseCanvasDocumentEdge)
  if (parsed.some((edge) => edge === null)) {
    throw new TypeError('Canvas document change contains an invalid edge')
  }
  return parsed as Array<CanvasDocumentEdge>
}

function assertUniqueIds(values: ReadonlyArray<{ id: string }>, kind: 'edge' | 'node'): void {
  const ids = new Set(values.map((value) => value.id))
  if (ids.size !== values.length) {
    throw new TypeError(`Canvas document change contains a duplicate ${kind} id`)
  }
}

function assertEdgeIds(edgeIds: ReadonlyArray<string>): void {
  if (edgeIds.some((id) => id.trim().length === 0)) {
    throw new TypeError('Canvas document change contains an invalid edge id')
  }
}

function parseDocumentElements(
  candidateNodes: ReadonlyArray<CanvasDocumentNode>,
  candidateEdges: ReadonlyArray<CanvasDocumentEdge>,
) {
  const nodes = parseNodes(candidateNodes)
  const edges = parseEdges(candidateEdges)
  assertUniqueIds(nodes, 'node')
  assertUniqueIds(edges, 'edge')
  return { nodes, edges }
}

export class CanvasDocumentController {
  readonly #document: Y.Doc
  readonly #edgesMap: Y.Map<CanvasDocumentEdge>
  readonly #historyListeners = new Set<() => void>()
  readonly #localOrigin = {}
  readonly #nodesMap: Y.Map<CanvasDocumentNode>
  readonly #undoManager: Y.UndoManager
  #disposed = false

  constructor(document: Y.Doc) {
    if (!parseCanvasDocumentContent(document)) {
      throw new TypeError('CanvasDocumentController requires a valid canvas document')
    }
    this.#document = document
    const { edgesMap, nodesMap } = getCanvasDocumentMaps(document)
    this.#edgesMap = edgesMap
    this.#nodesMap = nodesMap
    this.#undoManager = new Y.UndoManager([nodesMap, edgesMap], {
      captureTimeout: 0,
      trackedOrigins: new Set([this.#localOrigin]),
    })
  }

  get canUndo(): boolean {
    this.#assertActive()
    return this.#undoManager.undoStack.length > 0
  }

  get canRedo(): boolean {
    this.#assertActive()
    return this.#undoManager.redoStack.length > 0
  }

  read(): CanvasDocumentContent {
    this.#assertActive()
    const content = parseCanvasDocumentContent(this.#document)
    if (!content) throw new TypeError('Canvas document became invalid')
    return content
  }

  subscribe(listener: () => void): () => void {
    this.#assertActive()
    const changed = () => listener()
    this.#document.on('update', changed)
    return () => this.#document.off('update', changed)
  }

  subscribeHistory(listener: () => void): () => void {
    this.#assertActive()
    this.#historyListeners.add(listener)
    return () => this.#historyListeners.delete(listener)
  }

  apply(change: CanvasDocumentChange): CanvasDocumentChangeReceipt {
    this.#assertActive()
    switch (change.type) {
      case 'insert':
        return this.#insert(change.nodes, change.edges)
      case 'replace':
        return this.#replace(change.nodes, change.edges)
      case 'remove':
        return this.#remove(change.nodeIds, change.edgeIds)
    }
  }

  undo(): boolean {
    this.#assertActive()
    if (!this.canUndo) return false
    this.#undoManager.undo()
    this.#undoManager.stopCapturing()
    this.#notifyHistory()
    return true
  }

  redo(): boolean {
    this.#assertActive()
    if (!this.canRedo) return false
    this.#undoManager.redo()
    this.#undoManager.stopCapturing()
    this.#notifyHistory()
    return true
  }

  clearHistory(): void {
    this.#assertActive()
    if (!this.canUndo && !this.canRedo) return
    this.#undoManager.clear()
    this.#notifyHistory()
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#historyListeners.clear()
    this.#undoManager.destroy()
  }

  #insert(
    candidateNodes: ReadonlyArray<CanvasDocumentNode>,
    candidateEdges: ReadonlyArray<CanvasDocumentEdge>,
  ): CanvasDocumentChangeReceipt {
    if (candidateNodes.length === 0 && candidateEdges.length === 0) return NO_DOCUMENT_CHANGES

    const { edges, nodes } = parseDocumentElements(candidateNodes, candidateEdges)
    for (const node of nodes) {
      if (this.#nodesMap.has(node.id)) throw new Error(`Canvas node "${node.id}" already exists`)
    }
    for (const edge of edges) {
      if (this.#edgesMap.has(edge.id)) throw new Error(`Canvas edge "${edge.id}" already exists`)
    }

    const nodeIds = new Set(Array.from(this.#nodesMap.values(), (node) => node.id))
    nodes.forEach((node) => nodeIds.add(node.id))
    this.#assertConnectedEdges(edges, nodeIds)

    let nextZIndex = this.#nextZIndex()
    const insertedNodes = nodes.map((node) => ({
      ...node,
      zIndex: node.zIndex ?? nextZIndex++,
    })) as Array<CanvasDocumentNode>
    const insertedEdges = edges.map((edge) => ({
      ...edge,
      zIndex: edge.zIndex ?? nextZIndex++,
    }))

    this.#commit(() => {
      insertedNodes.forEach((node) => this.#nodesMap.set(node.id, node))
      insertedEdges.forEach((edge) => this.#edgesMap.set(edge.id, edge))
    })
    return { nodesChanged: insertedNodes.length, edgesChanged: insertedEdges.length }
  }

  #replace(
    candidateNodes: ReadonlyArray<CanvasDocumentNode>,
    candidateEdges: ReadonlyArray<CanvasDocumentEdge>,
  ): CanvasDocumentChangeReceipt {
    if (candidateNodes.length === 0 && candidateEdges.length === 0) return NO_DOCUMENT_CHANGES

    const { edges, nodes } = parseDocumentElements(candidateNodes, candidateEdges)
    this.#assertConnectedEdges(
      edges,
      new Set(Array.from(this.#nodesMap.values(), (node) => node.id)),
    )

    const replacedNodes = nodes.filter((node) => this.#nodesMap.has(node.id))
    const replacedEdges = edges.filter((edge) => this.#edgesMap.has(edge.id))
    if (replacedNodes.length === 0 && replacedEdges.length === 0) return NO_DOCUMENT_CHANGES

    this.#commit(() => {
      replacedNodes.forEach((node) => this.#nodesMap.set(node.id, node))
      replacedEdges.forEach((edge) => this.#edgesMap.set(edge.id, edge))
    })
    return { nodesChanged: replacedNodes.length, edgesChanged: replacedEdges.length }
  }

  #remove(
    candidateNodeIds: ReadonlyArray<CanvasNodeId>,
    candidateEdgeIds: ReadonlyArray<string>,
  ): CanvasDocumentChangeReceipt {
    candidateNodeIds.forEach((id) => assertDomainId(DOMAIN_ID_KIND.canvasNode, id))
    assertEdgeIds(candidateEdgeIds)
    const nodeIds = new Set(candidateNodeIds.filter((id) => this.#nodesMap.has(id)))
    const edgeIds = new Set(candidateEdgeIds.filter((id) => this.#edgesMap.has(id)))
    for (const [edgeId, edge] of this.#edgesMap) {
      if (nodeIds.has(edge.source) || nodeIds.has(edge.target)) edgeIds.add(edgeId)
    }
    if (nodeIds.size === 0 && edgeIds.size === 0) return NO_DOCUMENT_CHANGES

    this.#commit(() => {
      edgeIds.forEach((id) => this.#edgesMap.delete(id))
      nodeIds.forEach((id) => this.#nodesMap.delete(id))
    })
    return { nodesChanged: nodeIds.size, edgesChanged: edgeIds.size }
  }

  #assertConnectedEdges(
    edges: ReadonlyArray<CanvasDocumentEdge>,
    nodeIds: ReadonlySet<CanvasNodeId>,
  ): void {
    if (edges.some((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) {
      throw new TypeError('Canvas document change contains an edge with a missing endpoint')
    }
  }

  #nextZIndex(): number {
    const elements = [...this.#nodesMap.values(), ...this.#edgesMap.values()]
    return elements.reduce((max, element, index) => Math.max(max, element.zIndex ?? index), 0) + 1
  }

  #commit(change: () => void): void {
    this.#undoManager.stopCapturing()
    this.#document.transact(change, this.#localOrigin)
    this.#undoManager.stopCapturing()
    this.#notifyHistory()
  }

  #notifyHistory(): void {
    for (const listener of this.#historyListeners) listener()
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('CanvasDocumentController is disposed')
  }
}
