import { createEmbedCanvasNode } from '../../nodes/embed/embed-node-creation'
import { createCanvasNodePlacement, resizeCanvasNode } from '../../nodes/canvas-node-modules'
import type { CanvasNodeDataPatch } from '../../nodes/canvas-node-modules'
import { clampCanvasEdgeStrokeWidth } from '../../edges/shared/canvas-edge-style'
import type { CanvasEdgeCreationDefaults } from '../../tools/canvas-tool-types'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type { CanvasEdgePatch } from '../../edges/canvas-edge-types'
import { getCanvasDeletionSelection } from '../context-menu/canvas-context-menu-selection'
import type { CanvasReorderPlan } from './canvas-reorder-plan'
import type { CanvasContextMenuPoint } from '../context-menu/canvas-context-menu-types'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { EmbedTarget } from '../../../../../../shared/embeds/embedTargets'
import type {
  CanvasConnection as Connection,
  CanvasPosition,
} from '../../types/canvas-domain-types'
import type * as Y from 'yjs'
import type {
  CanvasEmbedDocumentNode,
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '../../document-contract'

type CanvasNodeSanitizer = (node: CanvasDocumentNode, operation: string) => CanvasDocumentNode
type CanvasEdgeStyle = NonNullable<CanvasDocumentEdge['style']>
type CanvasNodeMapUpdate = { id: string; node: CanvasDocumentNode }
type CanvasEdgeMapUpdate = { id: string; edge: CanvasDocumentEdge }

function getCanvasNodeUpdateIfPresent({
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
    return null
  }

  return {
    id: nodeId,
    node: sanitizeNode(updater(existing), operation),
  }
}

function applyCanvasNodeMapUpdates(
  nodesMap: Y.Map<CanvasDocumentNode>,
  updates: ReadonlyArray<CanvasNodeMapUpdate>,
) {
  for (const update of updates) {
    nodesMap.set(update.id, update.node)
  }
}

function applyCanvasEdgeMapUpdates(
  edgesMap: Y.Map<CanvasDocumentEdge>,
  updates: ReadonlyArray<CanvasEdgeMapUpdate>,
) {
  for (const update of updates) {
    edgesMap.set(update.id, update.edge)
  }
}

function updateCanvasNodeIfPresent(args: {
  nodesMap: Y.Map<CanvasDocumentNode>
  nodeId: string
  sanitizeNode: CanvasNodeSanitizer
  operation: string
  updater: (node: CanvasDocumentNode) => CanvasDocumentNode
}) {
  const update = getCanvasNodeUpdateIfPresent(args)
  if (update) {
    args.nodesMap.set(update.id, update.node)
  }
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

function mergeCanvasTextOrStrokeNodeData<
  TNode extends Extract<CanvasDocumentNode, { type: 'stroke' | 'text' }>,
>(existing: TNode, data: CanvasNodeDataPatch): TNode {
  return {
    ...existing,
    data: { ...existing.data, ...data },
  } as TNode
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

  applyCanvasNodeMapUpdates(nodesMap, [
    createCanvasNodeMapUpdate({
      node,
      sanitizeNode,
      nextZIndex,
      operation: 'createNode',
    }),
  ])
}

function createCanvasNodeMapUpdate({
  node,
  sanitizeNode,
  nextZIndex,
  operation,
}: {
  node: CanvasDocumentNode
  sanitizeNode: CanvasNodeSanitizer
  nextZIndex: number
  operation: string
}): CanvasNodeMapUpdate {
  return {
    id: node.id,
    node: sanitizeNode(
      {
        ...node,
        zIndex: node.zIndex ?? nextZIndex,
      },
      operation,
    ),
  }
}

export function createCanvasNodeCommandUpdates({
  nodesMap,
  nodes,
  sanitizeNode,
  nextZIndex,
  operation,
}: {
  nodesMap: Y.Map<CanvasDocumentNode>
  nodes: ReadonlyArray<CanvasDocumentNode>
  sanitizeNode: CanvasNodeSanitizer
  nextZIndex: number
  operation: string
}) {
  const nodeIds = new Set<string>()
  for (const node of nodes) {
    if (nodesMap.has(node.id) || nodeIds.has(node.id)) {
      throw new Error(`Canvas node "${node.id}" already exists`)
    }
    nodeIds.add(node.id)
  }

  return nodes.map((node, index) =>
    createCanvasNodeMapUpdate({
      node,
      sanitizeNode,
      nextZIndex: nextZIndex + index,
      operation,
    }),
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
  const nodeUpdates: Array<CanvasNodeMapUpdate> = []

  for (const [nodeId, data] of updates) {
    const update = getCanvasNodeUpdateIfPresent({
      nodesMap,
      nodeId,
      sanitizeNode,
      operation: 'patchNodeData',
      updater: (existing): CanvasDocumentNode => {
        switch (existing.type) {
          case 'embed':
            return {
              ...existing,
              data: normalizeEmbedNodeDataPatch(existing.data, data),
            } satisfies CanvasDocumentNode
          case 'stroke':
          case 'text':
            return mergeCanvasTextOrStrokeNodeData(existing, data)
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
    if (update) {
      nodeUpdates.push(update)
    }
  }

  applyCanvasNodeMapUpdates(nodesMap, nodeUpdates)
}

function normalizeEmbedNodeDataPatch(
  existingData: CanvasEmbedDocumentNode['data'],
  patch: CanvasNodeDataPatch<'embed'>,
): CanvasEmbedDocumentNode['data'] {
  const { sidebarItemId: _legacySidebarItemId, ...nextData } = {
    ...existingData,
    ...patch,
  } as CanvasEmbedDocumentNode['data'] & { sidebarItemId?: unknown }
  // lockedAspectRatio uses null as an explicit unset sentinel; undefined leaves it unchanged.
  if (patch.lockedAspectRatio === null) {
    delete nextData.lockedAspectRatio
  }
  return nextData
}

export function patchCanvasEdgesCommand({
  edgesMap,
  updates,
}: {
  edgesMap: Y.Map<CanvasDocumentEdge>
  updates: ReadonlyMap<string, CanvasEdgePatch>
}) {
  const edgeUpdates: Array<CanvasEdgeMapUpdate> = []
  for (const [edgeId, patch] of updates) {
    const existing = edgesMap.get(edgeId)
    if (existing) {
      edgeUpdates.push({
        id: edgeId,
        edge: {
          ...existing,
          ...patch,
          style: patch.style
            ? ({
                ...existing.style,
                ...clampCanvasEdgeStyle(patch.style),
              } satisfies CanvasEdgeStyle)
            : existing.style,
        },
      })
    }
  }
  applyCanvasEdgeMapUpdates(edgesMap, edgeUpdates)
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
  const nodeUpdates: Array<CanvasNodeMapUpdate> = []

  for (const [nodeId, update] of updates) {
    const nodeUpdate = getCanvasNodeUpdateIfPresent({
      nodesMap,
      nodeId,
      sanitizeNode,
      operation: 'resizeNodes',
      updater: (existing) => resizeCanvasNode(existing, update),
    })
    if (nodeUpdate) {
      nodeUpdates.push(nodeUpdate)
    }
  }

  applyCanvasNodeMapUpdates(nodesMap, nodeUpdates)
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
  const nodeUpdates: Array<CanvasNodeMapUpdate> = []

  for (const [nodeId, position] of positions) {
    const update = getCanvasNodeUpdateIfPresent({
      nodesMap,
      nodeId,
      sanitizeNode,
      operation: 'setNodePositions',
      updater: (existing) => ({ ...existing, position }),
    })
    if (update) {
      nodeUpdates.push(update)
    }
  }

  applyCanvasNodeMapUpdates(nodesMap, nodeUpdates)
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
    return { nodeCount: 0, edgeCount: 0 }
  }

  for (const edgeId of deletionSelection.edgeIds) {
    edgesMap.delete(edgeId)
  }
  for (const nodeId of deletionSelection.nodeIds) {
    nodesMap.delete(nodeId)
  }

  return {
    nodeCount: deletionSelection.nodeIds.size,
    edgeCount: deletionSelection.edgeIds.size,
  }
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
  const nodeIds = new Set<string>()
  for (const node of paste.nodes) {
    if (nodesMap.has(node.id) || nodeIds.has(node.id)) {
      throw new Error(`Canvas node "${node.id}" already exists`)
    }
    nodeIds.add(node.id)
  }

  const edgeIds = new Set<string>()
  for (const edge of paste.edges) {
    if (edgesMap.has(edge.id) || edgeIds.has(edge.id)) {
      throw new Error(`Canvas edge "${edge.id}" already exists`)
    }
    edgeIds.add(edge.id)
  }

  const nodes = paste.nodes.map((node) => ({
    id: node.id,
    node: sanitizeNode(node, 'pasteNode'),
  }))
  const edges = paste.edges.map((edge) => ({
    id: edge.id,
    edge: {
      ...edge,
      style: clampCanvasEdgeStyle(edge.style),
    },
  }))

  applyCanvasNodeMapUpdates(nodesMap, nodes)
  applyCanvasEdgeMapUpdates(edgesMap, edges)
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
  reorderUpdates.nodes.forEach((node) => {
    if (nodesMap.has(node.id)) {
      nodesMap.set(node.id, node)
    }
  })
  reorderUpdates.edges.forEach((edge) => {
    if (edgesMap.has(edge.id)) {
      edgesMap.set(edge.id, edge)
    }
  })
}

export function createAndSelectEmbeddedCanvasNode({
  sidebarItemId,
  pointerPosition,
  screenToCanvasPosition,
  createNode,
  setSelection,
}: {
  sidebarItemId: SidebarItemId
  pointerPosition: CanvasContextMenuPoint
  screenToCanvasPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  createNode: (node: CanvasDocumentNode) => void
  setSelection: (selection: CanvasSelectionSnapshot) => void
}) {
  return createAndSelectEmbedCanvasNode({
    target: { kind: 'resource', resourceId: sidebarItemId },
    pointerPosition,
    screenToCanvasPosition,
    createNode,
    setSelection,
  })
}

export function createAndSelectEmbedCanvasNode({
  target,
  pointerPosition,
  screenToCanvasPosition,
  createNode,
  setSelection,
}: {
  target: EmbedTarget
  pointerPosition: CanvasContextMenuPoint
  screenToCanvasPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  createNode: (node: CanvasDocumentNode) => void
  setSelection: (selection: CanvasSelectionSnapshot) => void
}) {
  const embedNode = createEmbedCanvasNode(target, screenToCanvasPosition(pointerPosition))
  createNode(embedNode)

  const nextSelection = { nodeIds: new Set([embedNode.id]), edgeIds: new Set<string>() }
  setSelection(nextSelection)
  return nextSelection
}

export function createAndSelectTextCanvasNode({
  pointerPosition,
  screenToCanvasPosition,
  createNode,
  setSelection,
  setPendingEditNodeId,
  setPendingEditNodePoint,
}: {
  pointerPosition: CanvasContextMenuPoint
  screenToCanvasPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  createNode: (node: CanvasDocumentNode) => void
  setSelection: (selection: CanvasSelectionSnapshot) => void
  setPendingEditNodeId: (nodeId: string | null) => void
  setPendingEditNodePoint: (point: CanvasContextMenuPoint | null) => void
}) {
  const placement = createCanvasNodePlacement('text', {
    position: screenToCanvasPosition(pointerPosition),
  })
  createNode(placement.node)

  const nextSelection = { nodeIds: new Set([placement.node.id]), edgeIds: new Set<string>() }
  setSelection(nextSelection)
  if (placement.startEditing) {
    setPendingEditNodePoint(pointerPosition)
    setPendingEditNodeId(placement.node.id)
  }
  return nextSelection
}
