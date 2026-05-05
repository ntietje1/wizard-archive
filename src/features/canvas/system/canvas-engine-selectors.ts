import type { CanvasEngineSnapshot } from './canvas-engine-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'

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
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftNode = left[index]
    const rightNode = right[index]
    if (
      leftNode?.id !== rightNode?.id ||
      leftNode?.type !== rightNode?.type ||
      leftNode?.data !== rightNode?.data
    ) {
      return false
    }
  }

  return true
}

export function areCanvasPropertyEdgesEqual(
  left: ReadonlyArray<CanvasDocumentEdge>,
  right: ReadonlyArray<CanvasDocumentEdge>,
) {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftEdge = left[index]
    const rightEdge = right[index]
    if (
      leftEdge?.id !== rightEdge?.id ||
      leftEdge?.type !== rightEdge?.type ||
      leftEdge?.style !== rightEdge?.style
    ) {
      return false
    }
  }

  return true
}

function getSelectedNodes(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  selectedNodeIds: ReadonlySet<string>,
) {
  if (selectedNodeIds.size === 0) {
    return EMPTY_SELECTED_NODES
  }

  return nodes.filter((node) => selectedNodeIds.has(node.id))
}

function getSelectedEdges(
  edges: ReadonlyArray<CanvasDocumentEdge>,
  selectedEdgeIds: ReadonlySet<string>,
) {
  if (selectedEdgeIds.size === 0) {
    return EMPTY_SELECTED_EDGES
  }

  return edges.filter((edge) => selectedEdgeIds.has(edge.id))
}
