import * as Y from 'yjs'
import {
  parseCanvasDocumentContent,
  parseCanvasDocumentEdge,
  parseCanvasDocumentNode,
} from './document-contract'
import type {
  CanvasDocumentContent,
  CanvasDocumentEdge,
  CanvasDocumentNode,
  CanvasEdgeStyle,
  CanvasEmbedNodeData,
  CanvasStrokeNodeData,
  CanvasTextNodeData,
} from './document-contract'
import {
  applyCanvasEdgeUpdate,
  applyCanvasNodeUpdate,
  createCanvasEdgeMap,
  createCanvasNodeMap,
  getCanvasDocumentMaps,
} from './document-crdt'
import { assertDomainId, DOMAIN_ID_KIND } from '../resources/domain-id'
import type { CanvasNodeId } from '../resources/domain-id'

export type CanvasDocumentChange =
  | Readonly<{
      type: 'insert'
      nodes: ReadonlyArray<CanvasDocumentNode>
      edges: ReadonlyArray<CanvasDocumentEdge>
    }>
  | Readonly<{
      type: 'update'
      nodes: ReadonlyArray<CanvasDocumentNodeUpdate>
      edges: ReadonlyArray<CanvasDocumentEdgeUpdate>
    }>
  | Readonly<{
      type: 'remove'
      nodeIds: ReadonlyArray<CanvasNodeId>
      edgeIds: ReadonlyArray<string>
    }>

type CanvasDocumentNodeUpdateBase<
  TType extends CanvasDocumentNode['type'],
  TData extends object,
> = Readonly<{
  id: CanvasNodeId
  type: TType
  position?: CanvasDocumentNode['position']
  data?: Partial<TData>
  width?: number | undefined
  height?: number | undefined
  hidden?: boolean | undefined
  zIndex?: number | undefined
}>

export type CanvasDocumentNodeUpdate =
  | CanvasDocumentNodeUpdateBase<'embed', CanvasEmbedNodeData>
  | CanvasDocumentNodeUpdateBase<'stroke', CanvasStrokeNodeData>
  | CanvasDocumentNodeUpdateBase<'text', CanvasTextNodeData>

export type CanvasDocumentEdgeUpdate = Readonly<{
  id: string
  source?: CanvasNodeId
  target?: CanvasNodeId
  type?: CanvasDocumentEdge['type']
  sourceHandle?: string | null | undefined
  targetHandle?: string | null | undefined
  style?: Partial<CanvasEdgeStyle> | undefined
  hidden?: boolean | undefined
  zIndex?: number | undefined
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

function mergePatch(current: Readonly<object>, patch: Readonly<object>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete merged[key]
    else merged[key] = value
  }
  return merged
}

function parseNodeUpdate(
  current: CanvasDocumentNode,
  update: CanvasDocumentNodeUpdate,
): CanvasDocumentNode {
  if (current.type !== update.type) {
    throw new TypeError('Canvas document updates cannot change a node type')
  }
  const candidate = {
    ...current,
    ...update,
    ...(update.data !== undefined ? { data: mergePatch(current.data, update.data) } : {}),
  }
  const parsed = parseCanvasDocumentNode(candidate)
  if (!parsed) throw new TypeError('Canvas document change contains an invalid node update')
  return parsed
}

function parseEdgeUpdate(
  current: CanvasDocumentEdge,
  update: CanvasDocumentEdgeUpdate,
): CanvasDocumentEdge {
  const candidate = {
    ...current,
    ...update,
    ...(update.style !== undefined
      ? { style: mergePatch(current.style ?? {}, update.style) }
      : Object.hasOwn(update, 'style')
        ? { style: undefined }
        : {}),
  }
  const parsed = parseCanvasDocumentEdge(candidate)
  if (!parsed) throw new TypeError('Canvas document change contains an invalid edge update')
  return parsed
}

export class CanvasDocumentController {
  readonly #document: Y.Doc
  readonly #edgesMap: Y.Map<Y.Map<unknown>>
  readonly #historyListeners = new Set<() => void>()
  readonly #localOrigin = {}
  readonly #nodesMap: Y.Map<Y.Map<unknown>>
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
      case 'update':
        return this.#update(change.nodes, change.edges)
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

    const content = this.read()
    const nodeIds = new Set(content.nodes.map((node) => node.id))
    nodes.forEach((node) => nodeIds.add(node.id))
    this.#assertConnectedEdges(edges, nodeIds)

    let nextZIndex = this.#nextZIndex(content)
    const insertedNodes = nodes.map((node) => ({
      ...node,
      zIndex: node.zIndex ?? nextZIndex++,
    })) as Array<CanvasDocumentNode>
    const insertedEdges = edges.map((edge) => ({
      ...edge,
      zIndex: edge.zIndex ?? nextZIndex++,
    }))

    this.#commit(() => {
      insertedNodes.forEach((node) => this.#nodesMap.set(node.id, createCanvasNodeMap(node)))
      insertedEdges.forEach((edge) => this.#edgesMap.set(edge.id, createCanvasEdgeMap(edge)))
    })
    return { nodesChanged: insertedNodes.length, edgesChanged: insertedEdges.length }
  }

  #update(
    candidateNodes: ReadonlyArray<CanvasDocumentNodeUpdate>,
    candidateEdges: ReadonlyArray<CanvasDocumentEdgeUpdate>,
  ): CanvasDocumentChangeReceipt {
    if (candidateNodes.length === 0 && candidateEdges.length === 0) return NO_DOCUMENT_CHANGES

    assertUniqueIds(candidateNodes, 'node')
    assertUniqueIds(candidateEdges, 'edge')
    const content = this.read()
    const nodesById = new Map(content.nodes.map((node) => [node.id, node]))
    const edgesById = new Map(content.edges.map((edge) => [edge.id, edge]))
    const nodeUpdates = candidateNodes.flatMap((update) => {
      const current = nodesById.get(update.id)
      return current ? [{ update, next: parseNodeUpdate(current, update) }] : []
    })
    const edgeUpdates = candidateEdges.flatMap((update) => {
      const current = edgesById.get(update.id)
      return current ? [{ update, next: parseEdgeUpdate(current, update) }] : []
    })
    this.#assertConnectedEdges(
      edgeUpdates.map(({ next }) => next),
      new Set(nodesById.keys()),
    )
    if (nodeUpdates.length === 0 && edgeUpdates.length === 0) return NO_DOCUMENT_CHANGES

    this.#commit(() => {
      nodeUpdates.forEach(({ update }) =>
        applyCanvasNodeUpdate(this.#nodesMap.get(update.id)!, update),
      )
      edgeUpdates.forEach(({ update }) =>
        applyCanvasEdgeUpdate(this.#edgesMap.get(update.id)!, update),
      )
    })
    return { nodesChanged: nodeUpdates.length, edgesChanged: edgeUpdates.length }
  }

  #remove(
    candidateNodeIds: ReadonlyArray<CanvasNodeId>,
    candidateEdgeIds: ReadonlyArray<string>,
  ): CanvasDocumentChangeReceipt {
    candidateNodeIds.forEach((id) => assertDomainId(DOMAIN_ID_KIND.canvasNode, id))
    assertEdgeIds(candidateEdgeIds)
    const nodeIds = new Set(candidateNodeIds.filter((id) => this.#nodesMap.has(id)))
    const edgeIds = new Set(candidateEdgeIds.filter((id) => this.#edgesMap.has(id)))
    for (const edge of this.read().edges) {
      const edgeId = edge.id
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

  #nextZIndex(content: CanvasDocumentContent): number {
    const elements = [...content.nodes, ...content.edges]
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
