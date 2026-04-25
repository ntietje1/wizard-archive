import type { CanvasEngineSnapshot } from './canvas-engine'
import type { Edge, Node } from '@xyflow/react'

export interface CanvasEdgeEndpointNodes {
  source: Node | null
  target: Node | null
}

export function selectCanvasSelectedNodes(snapshot: CanvasEngineSnapshot): ReadonlyArray<Node> {
  return getSelectedNodes(snapshot.nodes, snapshot.selection.nodeIds)
}

export function selectCanvasSelectedEdges(snapshot: CanvasEngineSnapshot): ReadonlyArray<Edge> {
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

export function areCanvasPropertyNodesEqual(left: ReadonlyArray<Node>, right: ReadonlyArray<Node>) {
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

export function areCanvasPropertyEdgesEqual(left: ReadonlyArray<Edge>, right: ReadonlyArray<Edge>) {
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

function getSelectedNodes(nodes: ReadonlyArray<Node>, selectedNodeIds: ReadonlySet<string>) {
  if (selectedNodeIds.size === 0) {
    return []
  }

  return nodes.filter((node) => selectedNodeIds.has(node.id))
}

function getSelectedEdges(edges: ReadonlyArray<Edge>, selectedEdgeIds: ReadonlySet<string>) {
  if (selectedEdgeIds.size === 0) {
    return []
  }

  return edges.filter((edge) => selectedEdgeIds.has(edge.id))
}
