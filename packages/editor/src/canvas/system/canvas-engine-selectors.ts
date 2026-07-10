import type { CanvasEngineSnapshot } from './canvas-engine-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../document-contract'
const EMPTY_SELECTED_NODES: ReadonlyArray<CanvasDocumentNode> = []
const EMPTY_SELECTED_EDGES: ReadonlyArray<CanvasDocumentEdge> = []

export interface CanvasEdgeEndpointNodes {
  source: CanvasDocumentNode | null
  target: CanvasDocumentNode | null
}

export function selectCanvasSelectedNodes(
  snapshot: CanvasEngineSnapshot,
): ReadonlyArray<CanvasDocumentNode> {
  return getSelectedNodes(snapshot.nodes, snapshot.selection.nodeIds)
}

export function selectCanvasSelectedEdges(
  snapshot: CanvasEngineSnapshot,
): ReadonlyArray<CanvasDocumentEdge> {
  return getSelectedEdges(snapshot.edges, snapshot.selection.edgeIds)
}

export function selectCanvasEdgeEndpointNodes(
  snapshot: CanvasEngineSnapshot,
  sourceId: string,
  targetId: string,
): CanvasEdgeEndpointNodes {
  return {
    source: snapshot.nodeLookup.get(sourceId)?.node ?? null,
    target: snapshot.nodeLookup.get(targetId)?.node ?? null,
  }
}

export function areCanvasEdgeEndpointNodesEqual(
  left: CanvasEdgeEndpointNodes,
  right: CanvasEdgeEndpointNodes,
) {
  return left.source === right.source && left.target === right.target
}

export function areCanvasPropertyNodesEqual(
  left: ReadonlyArray<CanvasDocumentNode>,
  right: ReadonlyArray<CanvasDocumentNode>,
) {
  return areCanvasPropertyItemsEqual(
    left,
    right,
    (leftNode, rightNode) =>
      leftNode.id === rightNode.id &&
      leftNode.type === rightNode.type &&
      leftNode.data === rightNode.data,
  )
}

export function areCanvasPropertyEdgesEqual(
  left: ReadonlyArray<CanvasDocumentEdge>,
  right: ReadonlyArray<CanvasDocumentEdge>,
) {
  return areCanvasPropertyItemsEqual(
    left,
    right,
    (leftEdge, rightEdge) =>
      leftEdge.id === rightEdge.id &&
      leftEdge.type === rightEdge.type &&
      leftEdge.style === rightEdge.style,
  )
}

function areCanvasPropertyItemsEqual<T>(
  left: ReadonlyArray<T>,
  right: ReadonlyArray<T>,
  areItemsEqual: (leftItem: T, rightItem: T) => boolean,
) {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index]
    const rightItem = right[index]
    if (leftItem === undefined || rightItem === undefined || !areItemsEqual(leftItem, rightItem)) {
      return false
    }
  }

  return true
}

function getSelectedNodes(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  selectedNodeIds: ReadonlySet<string>,
) {
  return getSelectedItems(nodes, selectedNodeIds, EMPTY_SELECTED_NODES)
}

function getSelectedEdges(
  edges: ReadonlyArray<CanvasDocumentEdge>,
  selectedEdgeIds: ReadonlySet<string>,
) {
  return getSelectedItems(edges, selectedEdgeIds, EMPTY_SELECTED_EDGES)
}

function getSelectedItems<T extends { id: string }>(
  items: ReadonlyArray<T>,
  selectedIds: ReadonlySet<string>,
  emptySelection: ReadonlyArray<T>,
) {
  if (selectedIds.size === 0) {
    return emptySelection
  }

  return items.filter((item) => selectedIds.has(item.id))
}
