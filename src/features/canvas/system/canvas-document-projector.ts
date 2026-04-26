import type {
  CanvasEngineSnapshot,
  CanvasInternalEdge,
  CanvasInternalNode,
} from './canvas-engine-types'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'
import type { CanvasEdge, CanvasNode } from '../types/canvas-domain-types'

export const EMPTY_NODES: ReadonlyArray<CanvasNode> = []
export const EMPTY_EDGES: ReadonlyArray<CanvasEdge> = []
export const EMPTY_NODE_LOOKUP: ReadonlyMap<string, CanvasInternalNode> = new Map()
export const EMPTY_EDGE_LOOKUP: ReadonlyMap<string, CanvasInternalEdge> = new Map()
export const EMPTY_EDGE_IDS_BY_NODE_ID: ReadonlyMap<string, ReadonlySet<string>> = new Map()
export const EMPTY_IDS: ReadonlyArray<string> = []
export const EMPTY_SET: ReadonlySet<string> = new Set()

export function projectCanvasDocumentSnapshot({
  snapshot,
  nodes,
  edges,
  draggingNodeIds,
}: {
  snapshot: CanvasEngineSnapshot
  nodes?: ReadonlyArray<CanvasNode>
  edges?: ReadonlyArray<CanvasEdge>
  draggingNodeIds: ReadonlySet<string>
}): Omit<CanvasEngineSnapshot, 'version'> {
  const nextNodes = nodes ?? snapshot.nodes
  const nextEdges = edges ?? snapshot.edges

  return {
    ...snapshot,
    nodes: nextNodes,
    edges: nextEdges,
    nodeIds: nextNodes.map((node) => node.id),
    edgeIds: nextEdges.map((edge) => edge.id),
    nodeLookup: createNodeLookup(nextNodes, snapshot.selection.nodeIds, draggingNodeIds),
    edgeLookup: createEdgeLookup(nextEdges, snapshot.selection.edgeIds),
    edgeIdsByNodeId: createEdgeAdjacency(nextEdges),
    dirtyNodeIds: nodes ? new Set(nextNodes.map((node) => node.id)) : EMPTY_SET,
    dirtyEdgeIds: edges ? new Set(nextEdges.map((edge) => edge.id)) : EMPTY_SET,
  }
}

export function patchCanvasNodes(
  nodes: ReadonlyArray<CanvasNode>,
  updates: ReadonlyMap<string, Partial<CanvasNode>>,
) {
  let changed = false
  const nextNodes = nodes.map((node) => {
    const patch = updates.get(node.id)
    if (!patch) {
      return node
    }

    if (
      Object.entries(patch).every(
        ([key, value]) => node[key as keyof CanvasNode] === (value as CanvasNode[keyof CanvasNode]),
      )
    ) {
      return node
    }

    const nextNode = { ...node, ...patch }
    changed = true
    return nextNode
  })

  return changed ? nextNodes : nodes
}

export function patchCanvasEdges(
  edges: ReadonlyArray<CanvasEdge>,
  updates: ReadonlyMap<string, CanvasEdgePatch>,
) {
  let changed = false
  const nextEdges = edges.map((edge) => {
    const patch = updates.get(edge.id)
    if (!patch) {
      return edge
    }

    const nextEdge = {
      ...edge,
      ...patch,
      style: patch.style ? { ...edge.style, ...patch.style } : edge.style,
    }
    if (isCanvasEdgePatchNoop(edge, patch)) {
      return edge
    }

    changed = true
    return nextEdge
  })

  return changed ? nextEdges : edges
}

export function createNodeLookup(
  nodes: ReadonlyArray<CanvasNode>,
  selectedNodeIds: ReadonlySet<string>,
  draggingNodeIds: ReadonlySet<string>,
): ReadonlyMap<string, CanvasInternalNode> {
  const lookup = new Map<string, CanvasInternalNode>()

  for (const node of nodes) {
    lookup.set(node.id, {
      id: node.id,
      node,
      positionAbsolute: node.position,
      measured: {
        width: node.width,
        height: node.height,
      },
      selected: selectedNodeIds.has(node.id),
      dragging: draggingNodeIds.has(node.id),
      resizing: false,
      zIndex: node.zIndex ?? 0,
      visible: !node.hidden,
    })
  }

  return lookup
}

function createEdgeLookup(
  edges: ReadonlyArray<CanvasEdge>,
  selectedEdgeIds: ReadonlySet<string>,
): ReadonlyMap<string, CanvasInternalEdge> {
  const lookup = new Map<string, CanvasInternalEdge>()

  for (const edge of edges) {
    lookup.set(edge.id, {
      id: edge.id,
      edge,
      selected: selectedEdgeIds.has(edge.id),
      zIndex: edge.zIndex ?? 0,
      visible: !edge.hidden,
    })
  }

  return lookup
}

function createEdgeAdjacency(
  edges: ReadonlyArray<CanvasEdge>,
): ReadonlyMap<string, ReadonlySet<string>> {
  const adjacency = new Map<string, Set<string>>()

  for (const edge of edges) {
    addEdgeAdjacency(adjacency, edge.source, edge.id)
    addEdgeAdjacency(adjacency, edge.target, edge.id)
  }

  return adjacency
}

function isCanvasEdgePatchNoop(edge: CanvasEdge, patch: CanvasEdgePatch) {
  if (patch.type !== undefined && patch.type !== edge.type) {
    return false
  }

  if (!patch.style) {
    return true
  }

  return Object.entries(patch.style).every(
    ([key, value]) => edge.style?.[key as keyof NonNullable<CanvasEdge['style']>] === value,
  )
}

function addEdgeAdjacency(adjacency: Map<string, Set<string>>, nodeId: string, edgeId: string) {
  const edgeIds = adjacency.get(nodeId) ?? new Set<string>()
  edgeIds.add(edgeId)
  adjacency.set(nodeId, edgeIds)
}
