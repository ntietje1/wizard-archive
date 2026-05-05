import { buildCanvasEdgePath } from './canvas-edge-paths'
import { createNodeLookup, EMPTY_SET } from './canvas-document-projector'
import type { CanvasEngineSnapshot, CanvasInternalNode } from './canvas-engine-types'
import type { CanvasDocumentNodePatch, CanvasPosition } from '../types/canvas-domain-types'
import type { CanvasDocumentNode } from 'convex/canvases/validation'

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
  ) => { snapshot: Omit<CanvasEngineSnapshot, 'version'>; notify: boolean } | null
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

      return {
        snapshot: {
          ...snapshot,
          nodeLookup: nextNodeLookup,
          dirtyNodeIds,
          dirtyEdgeIds: EMPTY_SET,
        },
        dirtyNodeIds,
        layoutPatches,
      }
    },
    stopDrag: (snapshot, dirtyNodeIds, activeDraggingNodeIds) => {
      const nextNodes = snapshot.nodes.map((node) => snapshot.nodeLookup.get(node.id)?.node ?? node)
      return {
        ...snapshot,
        nodes: nextNodes,
        nodeLookup: createNodeLookup(nextNodes, snapshot.selection.nodeIds, activeDraggingNodeIds),
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
      const nodeWithDimensions = usesMeasuredDimensions
        ? {
            ...existing.node,
            width: existing.node.width ?? dimensions.width,
            height: existing.node.height ?? dimensions.height,
          }
        : existing.node
      const nextNodeLookup = new Map(snapshot.nodeLookup)
      nextNodeLookup.set(nodeId, {
        ...existing,
        node: nodeWithDimensions,
        measured: dimensions,
      })

      if (!usesMeasuredDimensions) {
        return {
          snapshot: {
            ...snapshot,
            nodeLookup: nextNodeLookup,
          },
          notify: false,
        }
      }

      return {
        snapshot: {
          ...snapshot,
          nodeLookup: nextNodeLookup,
          dirtyNodeIds: new Set([nodeId]),
          dirtyEdgeIds: snapshot.edgeIdsByNodeId.get(nodeId) ?? EMPTY_SET,
        },
        notify: true,
      }
    },
    getConnectedEdgePaths: (snapshot, nodeIds) => {
      const paths = new Map<string, string>()
      const nodesById = createNodesById(snapshot.nodeLookup)

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
          const path = edge ? buildCanvasEdgePath(edge, nodesById) : null
          if (path) {
            paths.set(edgeId, path)
          }
        }
      }

      return paths
    },
  }
}

function createNodesById(nodeLookup: ReadonlyMap<string, CanvasInternalNode>) {
  const nodesById = new Map<string, CanvasDocumentNode>()
  for (const [nodeId, internalNode] of nodeLookup) {
    nodesById.set(nodeId, internalNode.node)
  }
  return nodesById
}
