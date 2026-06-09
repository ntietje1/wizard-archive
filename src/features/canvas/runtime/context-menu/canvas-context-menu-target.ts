import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type { CanvasEngineSnapshot } from '../../system/canvas-engine-types'
import type { CanvasContextMenuTarget } from './canvas-context-menu-types'
import { normalizeEmbedNodeData } from '../../nodes/embed/embed-node-data'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'

function getOrderedSelectedNodes(
  nodeIds: ReadonlySet<string>,
  nodeLookup: CanvasEngineSnapshot['nodeLookup'],
): Array<CanvasDocumentNode> {
  return Array.from(nodeIds)
    .map((nodeId) => nodeLookup.get(nodeId)?.node)
    .filter((node): node is CanvasDocumentNode => node !== undefined)
}

function getOrderedSelectedEdges(
  edgeIds: ReadonlySet<string>,
  edgeLookup: CanvasEngineSnapshot['edgeLookup'],
): Array<CanvasDocumentEdge> {
  return Array.from(edgeIds)
    .map((edgeId) => edgeLookup.get(edgeId)?.edge)
    .filter((edge): edge is CanvasDocumentEdge => edge !== undefined)
}

function getSharedValue<TItem, TValue>(
  items: ReadonlyArray<TItem>,
  getValue: (item: TItem) => TValue,
): TValue | null {
  let sharedValue: TValue | null = null
  let hasValue = false
  for (const item of items) {
    const value = getValue(item)
    if (!hasValue) {
      sharedValue = value
      hasValue = true
      continue
    }
    if (value !== sharedValue) {
      return null
    }
  }

  return sharedValue
}

function resolveNodeSelectionTarget(
  selection: CanvasSelectionSnapshot,
  snapshot: CanvasEngineSnapshot,
): CanvasContextMenuTarget {
  const selectedNodes = getOrderedSelectedNodes(selection.nodeIds, snapshot.nodeLookup)

  if (selectedNodes.length === 1) {
    const [selectedNode] = selectedNodes
    if (selectedNode.type === 'embed') {
      const target = normalizeEmbedNodeData(selectedNode.data).target
      if (target.kind === 'empty') {
        return {
          kind: 'node-selection',
          nodeIds: [selectedNode.id],
          nodeType: 'embed',
        }
      }
      return {
        kind: 'embed-node',
        nodeId: selectedNode.id,
        nodeType: 'embed',
        target,
      }
    }
  }

  const nodeType = getSharedValue(selectedNodes, (node) => node.type)
  return {
    kind: 'node-selection',
    nodeIds: selectedNodes.map((node) => node.id),
    nodeType,
  }
}

function resolveEdgeSelectionTarget(
  selection: CanvasSelectionSnapshot,
  snapshot: CanvasEngineSnapshot,
): CanvasContextMenuTarget {
  const selectedEdges = getOrderedSelectedEdges(selection.edgeIds, snapshot.edgeLookup)
  const edgeType = getSharedValue(selectedEdges, (edge) => edge.type)

  return {
    kind: 'edge-selection',
    edgeIds: selectedEdges.map((edge) => edge.id),
    edgeType,
  }
}

export function resolveCanvasContextMenuTarget(
  selection: CanvasSelectionSnapshot,
  snapshot: CanvasEngineSnapshot,
): CanvasContextMenuTarget {
  if (selection.nodeIds.size === 0 && selection.edgeIds.size === 0) {
    return { kind: 'pane' }
  }

  if (selection.nodeIds.size > 0 && selection.edgeIds.size > 0) {
    const selectedNodes = getOrderedSelectedNodes(selection.nodeIds, snapshot.nodeLookup)
    const selectedEdges = getOrderedSelectedEdges(selection.edgeIds, snapshot.edgeLookup)
    return {
      kind: 'mixed-selection',
      nodeIds: selectedNodes.map((node) => node.id),
      edgeIds: selectedEdges.map((edge) => edge.id),
    }
  }

  if (selection.nodeIds.size > 0) {
    return resolveNodeSelectionTarget(selection, snapshot)
  }

  return resolveEdgeSelectionTarget(selection, snapshot)
}
