import { createEmbedCanvasNode } from '../../nodes/embed/embed-node-creation'
import { resizeCanvasNode } from '../../nodes/canvas-node-modules'
import type { CanvasNodeDataPatch } from '../../nodes/canvas-node-modules'
import { clampCanvasEdgeStrokeWidth } from '../../edges/shared/canvas-edge-style'
import type { CanvasEdgeCreationDefaults } from '../../tools/canvas-tool-types'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type { CanvasEdgePatch } from '../../edges/canvas-edge-types'
import { getCanvasDeletionSelection } from '../context-menu/canvas-context-menu-selection'
import type { CanvasReorderPlan } from './canvas-reorder-plan'
import type { CanvasContextMenuPoint } from '../context-menu/canvas-context-menu-types'
import type { Id } from 'convex/_generated/dataModel'
import type {
  CanvasConnection as Connection,
  CanvasPosition,
} from '~/features/canvas/types/canvas-domain-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import type * as Y from 'yjs'

type CanvasNodeSanitizer = (
  node: CanvasDocumentNode,
  operation: string,
  fallbackNode?: CanvasDocumentNode,
) => CanvasDocumentNode
type CanvasEdgeStyle = NonNullable<CanvasDocumentEdge['style']>

function updateCanvasNodeIfPresent({
  nodesMap,
  nodeId,
  sanitizeNode,
  operation,
  updater,
}: {
  nodesMap: Y.Map<CanvasDocumentNode>
  nodeId: string
  sanitizeNode: CanvasNodeSanitizer
  operation: string
  updater: (node: CanvasDocumentNode) => CanvasDocumentNode
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
  edgesMap: Y.Map<CanvasDocumentEdge>
  edgeId: string
  updater: (edge: CanvasDocumentEdge) => CanvasDocumentEdge
}) {
  const existing = edgesMap.get(edgeId)
  if (!existing) {
    return
  }

  edgesMap.set(edgeId, updater(existing))
}

function clampCanvasEdgeStyle<
  TStyle extends CanvasDocumentEdge['style'] | CanvasEdgePatch['style'],
>(style: TStyle): TStyle {
  if (!style || typeof style.strokeWidth !== 'number') {
    return style
  }

  return {
    ...style,
    strokeWidth: clampCanvasEdgeStrokeWidth(style.strokeWidth),
  } as TStyle
}

export function createCanvasNodeCommand({
  nodesMap,
  node,
  sanitizeNode,
  nextZIndex,
}: {
  nodesMap: Y.Map<CanvasDocumentNode>
  node: CanvasDocumentNode
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
  nodesMap: Y.Map<CanvasDocumentNode>
  updates: ReadonlyMap<string, CanvasNodeDataPatch>
  sanitizeNode: CanvasNodeSanitizer
}) {
  for (const [nodeId, data] of updates) {
    updateCanvasNodeIfPresent({
      nodesMap,
      nodeId,
      sanitizeNode,
      operation: 'patchNodeData',
      updater: (existing): CanvasDocumentNode => {
        switch (existing.type) {
          case 'embed':
            return {
              ...existing,
              data: { ...existing.data, ...data } as typeof existing.data,
            } satisfies CanvasDocumentNode
          case 'stroke':
            return {
              ...existing,
              data: { ...existing.data, ...data } as typeof existing.data,
            } satisfies CanvasDocumentNode
          case 'text':
            return {
              ...existing,
              data: { ...existing.data, ...data } as typeof existing.data,
            } satisfies CanvasDocumentNode
          default: {
            const nodeType =
              typeof existing === 'object' && existing !== null && 'type' in existing
                ? String((existing as { type?: unknown }).type)
                : typeof existing
            const _exhaustive: never = existing
            void _exhaustive
            throw new Error(`Unhandled canvas node type in patchNodeData: ${nodeType}`)
          }
        }
      },
    })
  }
}

export function patchCanvasEdgesCommand({
  edgesMap,
  updates,
}: {
  edgesMap: Y.Map<CanvasDocumentEdge>
  updates: ReadonlyMap<string, CanvasEdgePatch>
}) {
  for (const [edgeId, patch] of updates) {
    updateCanvasEdgeIfPresent({
      edgesMap,
      edgeId,
      updater: (existing) => ({
        ...existing,
        ...patch,
        style: patch.style
          ? ({ ...existing.style, ...clampCanvasEdgeStyle(patch.style) } satisfies CanvasEdgeStyle)
          : existing.style,
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
  nodesMap: Y.Map<CanvasDocumentNode>
  nodeId: string
  width: number
  height: number
  position: CanvasPosition
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

export function resizeCanvasNodesCommand({
  nodesMap,
  updates,
  sanitizeNode,
}: {
  nodesMap: Y.Map<CanvasDocumentNode>
  updates: ReadonlyMap<string, { width: number; height: number; position: CanvasPosition }>
  sanitizeNode: CanvasNodeSanitizer
}) {
  for (const [nodeId, update] of updates) {
    updateCanvasNodeIfPresent({
      nodesMap,
      nodeId,
      sanitizeNode,
      operation: 'resizeNodes',
      updater: (existing) => resizeCanvasNode(existing, update),
    })
  }
}

export function setCanvasNodePositionsCommand({
  nodesMap,
  positions,
  sanitizeNode,
}: {
  nodesMap: Y.Map<CanvasDocumentNode>
  positions: ReadonlyMap<string, CanvasPosition>
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
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
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
  edgesMap: Y.Map<CanvasDocumentEdge>
  connection: Connection
  defaults?: CanvasEdgeCreationDefaults
  nextZIndex: number
}) {
  const id = `e-${connection.source}-${connection.target}-${crypto.randomUUID()}`
  edgesMap.set(id, {
    ...connection,
    id,
    type: defaults?.type ?? 'bezier',
    style: clampCanvasEdgeStyle(defaults?.style),
    zIndex: nextZIndex,
  })
}

export function deleteCanvasEdgesCommand({
  edgesMap,
  edgeIds,
}: {
  edgesMap: Y.Map<CanvasDocumentEdge>
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
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
  paste: {
    nodes: Array<CanvasDocumentNode>
    edges: Array<CanvasDocumentEdge>
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
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
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
  setSelection,
}: {
  sidebarItemId: Id<'sidebarItems'>
  pointerPosition: CanvasContextMenuPoint
  screenToCanvasPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  createNode: (node: CanvasDocumentNode) => void
  setSelection: (selection: CanvasSelectionSnapshot) => void
}) {
  const embedNode = createEmbedCanvasNode(sidebarItemId, screenToCanvasPosition(pointerPosition))
  createNode(embedNode)

  const nextSelection = { nodeIds: new Set([embedNode.id]), edgeIds: new Set<string>() }
  setSelection(nextSelection)
  return nextSelection
}
