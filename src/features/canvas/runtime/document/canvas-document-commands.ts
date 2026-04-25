import { createEmbedCanvasNode } from '../../nodes/embed/embed-node-creation'
import { resizeCanvasNode } from '../../nodes/canvas-node-modules'
import type {
  CanvasEdgeCreationDefaults,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type { CanvasEdgePatch } from '../../edges/canvas-edge-types'
import { getCanvasDeletionSelection } from '../context-menu/canvas-context-menu-selection'
import type { CanvasReorderPlan } from './canvas-reorder-plan'
import type { CanvasContextMenuPoint } from '../context-menu/canvas-context-menu-types'
import type { Id } from 'convex/_generated/dataModel'
import type { Connection, Edge, Node, XYPosition } from '@xyflow/react'
import type * as Y from 'yjs'

export type CanvasNodeSanitizer = (node: Node, operation: string, fallbackNode?: Node) => Node

function updateCanvasNodeIfPresent({
  nodesMap,
  nodeId,
  sanitizeNode,
  operation,
  updater,
}: {
  nodesMap: Y.Map<Node>
  nodeId: string
  sanitizeNode: CanvasNodeSanitizer
  operation: string
  updater: (node: Node) => Node
}) {
  const existing = nodesMap.get(nodeId)
  if (!existing) {
    return
  }

  nodesMap.set(nodeId, sanitizeNode(updater(existing), operation, existing))
}

function updateCanvasEdgeIfPresent({
  edgesMap,
  edgeId,
  updater,
}: {
  edgesMap: Y.Map<Edge>
  edgeId: string
  updater: (edge: Edge) => Edge
}) {
  const existing = edgesMap.get(edgeId)
  if (!existing) {
    return
  }

  edgesMap.set(edgeId, updater(existing))
}

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

export function patchCanvasNodeDataCommand({
  nodesMap,
  updates,
  sanitizeNode,
}: {
  nodesMap: Y.Map<Node>
  updates: ReadonlyMap<string, Record<string, unknown>>
  sanitizeNode: CanvasNodeSanitizer
}) {
  for (const [nodeId, data] of updates) {
    updateCanvasNodeIfPresent({
      nodesMap,
      nodeId,
      sanitizeNode,
      operation: 'patchNodeData',
      updater: (existing) => ({
        ...existing,
        data: { ...existing.data, ...data },
      }),
    })
  }
}

export function patchCanvasEdgesCommand({
  edgesMap,
  updates,
}: {
  edgesMap: Y.Map<Edge>
  updates: ReadonlyMap<string, CanvasEdgePatch>
}) {
  for (const [edgeId, patch] of updates) {
    updateCanvasEdgeIfPresent({
      edgesMap,
      edgeId,
      updater: (existing) => ({
        ...existing,
        ...patch,
        style: patch.style ? { ...existing.style, ...patch.style } : existing.style,
      }),
    })
  }
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
  updateCanvasNodeIfPresent({
    nodesMap,
    nodeId,
    sanitizeNode,
    operation: 'resizeNode',
    updater: (existing) => resizeCanvasNode(existing, { width, height, position }),
  })
}

export function setCanvasNodePositionsCommand({
  nodesMap,
  positions,
  sanitizeNode,
}: {
  nodesMap: Y.Map<Node>
  positions: ReadonlyMap<string, XYPosition>
  sanitizeNode: CanvasNodeSanitizer
}) {
  for (const [nodeId, position] of positions) {
    updateCanvasNodeIfPresent({
      nodesMap,
      nodeId,
      sanitizeNode,
      operation: 'setNodePositions',
      updater: (existing) => ({ ...existing, position }),
    })
  }
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
  if (deletionSelection.nodeIds.size === 0 && deletionSelection.edgeIds.size === 0) {
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
  defaults,
  nextZIndex,
}: {
  edgesMap: Y.Map<Edge>
  connection: Connection
  defaults?: CanvasEdgeCreationDefaults
  nextZIndex: number
}) {
  const id = `e-${connection.source}-${connection.target}-${crypto.randomUUID()}`
  edgesMap.set(id, {
    ...connection,
    id,
    type: defaults?.type ?? 'bezier',
    style: defaults?.style,
    zIndex: nextZIndex,
  })
}

export function deleteCanvasEdgesCommand({
  edgesMap,
  edgeIds,
}: {
  edgesMap: Y.Map<Edge>
  edgeIds: ReadonlySet<string>
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
  reorderUpdates: CanvasReorderPlan
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
  screenToCanvasPosition,
  createNode,
  replaceSelection,
}: {
  sidebarItemId: Id<'sidebarItems'>
  pointerPosition: CanvasContextMenuPoint
  screenToCanvasPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  createNode: (node: Node) => void
  replaceSelection: (selection: CanvasSelectionSnapshot) => void
}) {
  const embedNode = createEmbedCanvasNode(sidebarItemId, screenToCanvasPosition(pointerPosition))
  createNode(embedNode)

  const nextSelection = { nodeIds: new Set([embedNode.id]), edgeIds: new Set<string>() }
  replaceSelection(nextSelection)
  return nextSelection
}
