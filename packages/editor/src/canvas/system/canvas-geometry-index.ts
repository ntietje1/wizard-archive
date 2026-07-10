import { buildCanvasEdgePath } from './canvas-edge-paths'
import { EMPTY_SET } from './canvas-document-projector'
import type { CanvasEngineSnapshot, CanvasInternalNode } from './canvas-engine-types'
import type { CanvasDocumentNodePatch, CanvasPosition } from '../types/canvas-domain-types'
import type { CanvasDocumentNode } from '../document-contract'
interface CanvasGeometryIndex {
  updateDraggedNodePositions: (
    snapshot: CanvasEngineSnapshot,
    positions: ReadonlyMap<string, CanvasPosition>,
  ) => { snapshot: Omit<CanvasEngineSnapshot, 'version'>; dirtyNodeIds: ReadonlySet<string> } | null
  updateResizedNodeBounds: (
    snapshot: CanvasEngineSnapshot,
    updates: ReadonlyMap<string, CanvasDocumentNodePatch>,
  ) => {
    snapshot: Omit<CanvasEngineSnapshot, 'version'>
    dirtyNodeIds: ReadonlySet<string>
    layoutPatches: ReadonlyMap<string, CanvasDocumentNodePatch>
  } | null
  stopDrag: (
    snapshot: CanvasEngineSnapshot,
    dirtyNodeIds: ReadonlySet<string>,
    activeDraggingNodeIds: ReadonlySet<string>,
  ) => Omit<CanvasEngineSnapshot, 'version'>
  measureNode: (
    snapshot: CanvasEngineSnapshot,
    nodeId: string,
    dimensions: { width: number; height: number },
  ) => {
    snapshot: Omit<CanvasEngineSnapshot, 'version'>
    dirtyNodeIds: ReadonlySet<string>
    notify: boolean
  } | null
  getConnectedEdgePaths: (
    snapshot: CanvasEngineSnapshot,
    nodeIds: ReadonlySet<string>,
  ) => ReadonlyMap<string, string>
}

export function createCanvasGeometryIndex(): CanvasGeometryIndex {
  return {
    updateDraggedNodePositions: (snapshot, positions) => {
      if (positions.size === 0) {
        return null
      }

      const nextNodeLookup = new Map(snapshot.nodeLookup)
      const dirtyNodeIds = new Set<string>()
      let changed = false

      for (const [nodeId, position] of positions) {
        const existing = nextNodeLookup.get(nodeId)
        if (
          !existing ||
          (existing.node.position.x === position.x && existing.node.position.y === position.y)
        ) {
          continue
        }

        dirtyNodeIds.add(nodeId)
        nextNodeLookup.set(nodeId, {
          ...existing,
          node: { ...existing.node, position },
          positionAbsolute: position,
          dragging: true,
        })
        changed = true
      }

      if (!changed) {
        return null
      }

      return {
        snapshot: {
          ...snapshot,
          nodeLookup: nextNodeLookup,
          dirtyNodeIds,
          dirtyEdgeIds: EMPTY_SET,
        },
        dirtyNodeIds,
      }
    },
    updateResizedNodeBounds: (snapshot, updates) => {
      if (updates.size === 0) {
        return null
      }

      const nextNodeLookup = new Map(snapshot.nodeLookup)
      const dirtyNodeIds = new Set<string>()
      const layoutPatches = new Map<string, CanvasDocumentNodePatch>()
      let changed = false

      for (const [nodeId, update] of updates) {
        const existing = nextNodeLookup.get(nodeId)
        if (!existing) {
          continue
        }

        const nextPosition = update.position ?? existing.node.position
        const nextWidth = update.width ?? existing.node.width
        const nextHeight = update.height ?? existing.node.height
        if (
          existing.node.position.x === nextPosition.x &&
          existing.node.position.y === nextPosition.y &&
          existing.node.width === nextWidth &&
          existing.node.height === nextHeight
        ) {
          continue
        }

        const nextNode = {
          ...existing.node,
          position: nextPosition,
          width: nextWidth,
          height: nextHeight,
        }
        dirtyNodeIds.add(nodeId)
        layoutPatches.set(nodeId, {
          position: nextPosition,
          width: nextWidth,
          height: nextHeight,
        })
        nextNodeLookup.set(nodeId, {
          ...existing,
          node: nextNode,
          positionAbsolute: nextPosition,
          measured: {
            width: nextWidth,
            height: nextHeight,
          },
        })
        changed = true
      }

      if (!changed) {
        return null
      }

      const nextNodes = snapshot.nodes.map((node) => nextNodeLookup.get(node.id)?.node ?? node)

      return {
        snapshot: {
          ...snapshot,
          nodes: nextNodes,
          nodeLookup: nextNodeLookup,
          dirtyNodeIds,
          dirtyEdgeIds: EMPTY_SET,
        },
        dirtyNodeIds,
        layoutPatches,
      }
    },
    stopDrag: (snapshot, dirtyNodeIds, activeDraggingNodeIds) => {
      const nextNodeLookup = new Map(snapshot.nodeLookup)
      for (const nodeId of dirtyNodeIds) {
        const existing = snapshot.nodeLookup.get(nodeId)
        if (!existing) {
          continue
        }

        nextNodeLookup.set(nodeId, {
          ...existing,
          dragging: activeDraggingNodeIds.has(nodeId),
        })
      }

      const nextNodes = snapshot.nodes.map((node) =>
        dirtyNodeIds.has(node.id) ? (nextNodeLookup.get(node.id)?.node ?? node) : node,
      )
      return {
        ...snapshot,
        nodes: nextNodes,
        nodeLookup: nextNodeLookup,
        dirtyNodeIds,
        dirtyEdgeIds: EMPTY_SET,
      }
    },
    measureNode: (snapshot, nodeId, dimensions) => {
      const existing = snapshot.nodeLookup.get(nodeId)
      if (
        !existing ||
        (existing.measured.width === dimensions.width &&
          existing.measured.height === dimensions.height)
      ) {
        return null
      }

      const usesMeasuredDimensions =
        typeof existing.node.width !== 'number' || typeof existing.node.height !== 'number'
      const nextNodeLookup = new Map(snapshot.nodeLookup)
      nextNodeLookup.set(nodeId, {
        ...existing,
        node: existing.node,
        measured: dimensions,
      })

      if (!usesMeasuredDimensions) {
        return {
          snapshot: {
            ...snapshot,
            nodeLookup: nextNodeLookup,
          },
          dirtyNodeIds: EMPTY_SET,
          notify: false,
        }
      }

      const dirtyNodeIds = new Set([nodeId])
      return {
        snapshot: {
          ...snapshot,
          nodeLookup: nextNodeLookup,
          dirtyNodeIds,
          dirtyEdgeIds: snapshot.edgeIdsByNodeId.get(nodeId) ?? EMPTY_SET,
        },
        dirtyNodeIds,
        notify: true,
      }
    },
    getConnectedEdgePaths: (snapshot, nodeIds) => {
      const paths = new Map<string, string>()

      for (const nodeId of nodeIds) {
        const connectedEdgeIds = snapshot.edgeIdsByNodeId.get(nodeId)
        if (!connectedEdgeIds) {
          continue
        }

        for (const edgeId of connectedEdgeIds) {
          if (paths.has(edgeId)) {
            continue
          }

          const edge = snapshot.edgeLookup.get(edgeId)?.edge
          const path = edge ? buildCanvasEdgePath(edge, getMeasuredEdgeNodes(snapshot, edge)) : null
          if (path) {
            paths.set(edgeId, path)
          }
        }
      }

      return paths
    },
  }
}

function getMeasuredEdgeNodes(
  snapshot: CanvasEngineSnapshot,
  edge: { source: string; target: string },
) {
  const nodesById = new Map<string, CanvasDocumentNode>()
  const source = snapshot.nodeLookup.get(edge.source)
  const target = snapshot.nodeLookup.get(edge.target)
  if (source) {
    nodesById.set(edge.source, getMeasuredNode(source))
  }
  if (target) {
    nodesById.set(edge.target, getMeasuredNode(target))
  }
  return nodesById
}

function getMeasuredNode({ measured, node }: CanvasInternalNode): CanvasDocumentNode {
  if (
    (typeof node.width === 'number' && typeof node.height === 'number') ||
    typeof measured.width !== 'number' ||
    typeof measured.height !== 'number'
  ) {
    return node
  }

  return {
    ...node,
    width: node.width ?? measured.width,
    height: node.height ?? measured.height,
  }
}
