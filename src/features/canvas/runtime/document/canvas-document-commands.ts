import { createEmbedCanvasNode } from '../../nodes/embed/embed-node-creation'
import { getCanvasNodeModuleByType } from '../../nodes/canvas-node-modules'
import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'
import { getCanvasDeletionSelection } from '../context-menu/canvas-context-menu-selection'
import type { CanvasReorderUpdates } from '../context-menu/canvas-context-menu-reorder'
import type { CanvasContextMenuPoint } from '../context-menu/canvas-context-menu-types'
import type { Id } from 'convex/_generated/dataModel'
import type { Connection, Edge, Node, XYPosition } from '@xyflow/react'
import type * as Y from 'yjs'

export type CanvasNodeSanitizer = (node: Node, operation: string, fallbackNode?: Node) => Node

export function createCanvasNodeCommand({
  nodesMap,
  node,
  sanitizeNode,
  nextZIndex,
}: {
  nodesMap: Y.Map<Node>
  node: Node
  sanitizeNode: CanvasNodeSanitizer
  nextZIndex: number
}) {
  if (nodesMap.has(node.id)) {
    throw new Error(`Canvas node "${node.id}" already exists`)
  }

  nodesMap.set(
    node.id,
    sanitizeNode(
      {
        ...node,
        zIndex: node.zIndex ?? nextZIndex,
      },
      'createNode',
    ),
  )
}

export function updateCanvasNodeCommand({
  nodesMap,
  nodeId,
  updater,
  sanitizeNode,
}: {
  nodesMap: Y.Map<Node>
  nodeId: string
  updater: (node: Node) => Node
  sanitizeNode: CanvasNodeSanitizer
}) {
  const existing = nodesMap.get(nodeId)
  if (!existing) {
    return
  }

  nodesMap.set(nodeId, sanitizeNode(updater(existing), 'updateNode', existing))
}

export function updateCanvasNodeDataCommand({
  nodesMap,
  nodeId,
  data,
  sanitizeNode,
}: {
  nodesMap: Y.Map<Node>
  nodeId: string
  data: Record<string, unknown>
  sanitizeNode: CanvasNodeSanitizer
}) {
  const existing = nodesMap.get(nodeId)
  if (!existing) {
    return
  }

  nodesMap.set(
    nodeId,
    sanitizeNode(
      {
        ...existing,
        data: { ...existing.data, ...data },
      },
      'updateNodeData',
      existing,
    ),
  )
}

export function resizeCanvasNodeCommand({
  nodesMap,
  nodeId,
  width,
  height,
  position,
  sanitizeNode,
}: {
  nodesMap: Y.Map<Node>
  nodeId: string
  width: number
  height: number
  position: XYPosition
  sanitizeNode: CanvasNodeSanitizer
}) {
  const existing = nodesMap.get(nodeId)
  if (!existing) {
    return
  }

  const nodeModule = getCanvasNodeModuleByType(existing.type)
  nodesMap.set(
    nodeId,
    sanitizeNode(
      nodeModule?.resize
        ? nodeModule.resize(existing, { width, height, position })
        : { ...existing, width, height, position },
      'resizeNode',
      existing,
    ),
  )
}

export function setCanvasNodePositionCommand({
  nodesMap,
  nodeId,
  position,
  sanitizeNode,
}: {
  nodesMap: Y.Map<Node>
  nodeId: string
  position: XYPosition
  sanitizeNode: CanvasNodeSanitizer
}) {
  const existing = nodesMap.get(nodeId)
  if (!existing) {
    return
  }

  nodesMap.set(nodeId, sanitizeNode({ ...existing, position }, 'setNodePosition', existing))
}

export function deleteCanvasSelectionCommand({
  nodesMap,
  edgesMap,
  selection,
}: {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  selection: CanvasSelectionSnapshot
}) {
  const deletionSelection = getCanvasDeletionSelection(edgesMap, selection)
  if (deletionSelection.nodeIds.length === 0 && deletionSelection.edgeIds.length === 0) {
    return false
  }

  for (const edgeId of deletionSelection.edgeIds) {
    edgesMap.delete(edgeId)
  }
  for (const nodeId of deletionSelection.nodeIds) {
    nodesMap.delete(nodeId)
  }

  return true
}

export function createCanvasEdgeCommand({
  edgesMap,
  connection,
  nextZIndex,
}: {
  edgesMap: Y.Map<Edge>
  connection: Connection
  nextZIndex: number
}) {
  const id = `e-${connection.source}-${connection.target}-${crypto.randomUUID()}`
  edgesMap.set(id, {
    ...connection,
    id,
    type: 'bezier',
    zIndex: nextZIndex,
  })
}

export function deleteCanvasEdgesCommand({
  edgesMap,
  edgeIds,
}: {
  edgesMap: Y.Map<Edge>
  edgeIds: Array<string>
}) {
  for (const edgeId of edgeIds) {
    edgesMap.delete(edgeId)
  }
}

export function applyCanvasPasteCommand({
  nodesMap,
  edgesMap,
  paste,
  sanitizeNode,
  onApplied,
}: {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  paste: {
    nodes: Array<Node>
    edges: Array<Edge>
    selection: CanvasSelectionSnapshot
  }
  sanitizeNode: CanvasNodeSanitizer
  onApplied?: () => void
}) {
  for (const node of paste.nodes) {
    if (nodesMap.has(node.id)) {
      throw new Error(`Canvas node "${node.id}" already exists`)
    }

    nodesMap.set(node.id, sanitizeNode(node, 'pasteNode'))
  }
  for (const edge of paste.edges) {
    if (edgesMap.has(edge.id)) {
      throw new Error(`Canvas edge "${edge.id}" already exists`)
    }

    edgesMap.set(edge.id, edge)
  }
  onApplied?.()
  return paste.selection
}

export function applyCanvasReorderCommand({
  nodesMap,
  edgesMap,
  reorderUpdates,
}: {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  reorderUpdates: CanvasReorderUpdates
}) {
  reorderUpdates.nodes?.forEach((node) => {
    nodesMap.set(node.id, node)
  })
  reorderUpdates.edges?.forEach((edge) => {
    edgesMap.set(edge.id, edge)
  })
}

export function createAndSelectEmbeddedCanvasNode({
  sidebarItemId,
  pointerPosition,
  screenToFlowPosition,
  createNode,
  replaceSelection,
}: {
  sidebarItemId: Id<'sidebarItems'>
  pointerPosition: CanvasContextMenuPoint
  screenToFlowPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  createNode: (node: Node) => void
  replaceSelection: (selection: CanvasSelectionSnapshot) => void
}) {
  const embedNode = createEmbedCanvasNode(sidebarItemId, screenToFlowPosition(pointerPosition))
  createNode(embedNode)

  const nextSelection = { nodeIds: [embedNode.id], edgeIds: [] }
  replaceSelection(nextSelection)
  return nextSelection
}
