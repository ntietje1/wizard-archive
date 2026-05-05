import { reorderCanvasElementIds } from './canvas-reorder'
import { applyCanvasZOrder, sortCanvasElementsByZIndex } from './canvas-z-order'
import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type { CanvasReorderDirection } from './canvas-reorder'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import type * as Y from 'yjs'

export interface CanvasReorderPlan {
  nodes: Array<CanvasDocumentNode> | null
  edges: Array<CanvasDocumentEdge> | null
}

function getCurrentCanvasNodes(nodesMap: Y.Map<CanvasDocumentNode>): Array<CanvasDocumentNode> {
  return sortCanvasElementsByZIndex(
    Array.from(nodesMap.values()).map((node) => stripEphemeralCanvasNodeState(node)),
  )
}

function getCurrentCanvasEdges(edgesMap: Y.Map<CanvasDocumentEdge>): Array<CanvasDocumentEdge> {
  return sortCanvasElementsByZIndex(Array.from(edgesMap.values()))
}

export function createCanvasReorderPlan(
  nodesMap: Y.Map<CanvasDocumentNode>,
  edgesMap: Y.Map<CanvasDocumentEdge>,
  selection: CanvasSelectionSnapshot,
  direction: CanvasReorderDirection,
): CanvasReorderPlan | null {
  const hasNodes = selection.nodeIds.size > 0
  const hasEdges = selection.edgeIds.size > 0
  if (!hasNodes && !hasEdges) {
    return null
  }

  const currentNodes = hasNodes ? getCurrentCanvasNodes(nodesMap) : null
  const currentEdges = hasEdges ? getCurrentCanvasEdges(edgesMap) : null

  return {
    nodes: currentNodes
      ? applyCanvasZOrder(
          currentNodes,
          reorderCanvasElementIds(
            currentNodes.map((node) => node.id),
            selection.nodeIds,
            direction,
          ),
        )
      : null,
    edges: currentEdges
      ? applyCanvasZOrder(
          currentEdges,
          reorderCanvasElementIds(
            currentEdges.map((edge) => edge.id),
            selection.edgeIds,
            direction,
          ),
        )
      : null,
  }
}
