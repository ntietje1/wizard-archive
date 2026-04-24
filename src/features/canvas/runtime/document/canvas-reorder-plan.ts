import { reorderCanvasElementIds } from './canvas-reorder'
import { applyCanvasZOrder, sortCanvasElementsByZIndex } from './canvas-z-order'
import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'
import type { CanvasReorderDirection } from './canvas-reorder'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

export interface CanvasReorderPlan {
  nodes: Array<Node> | null
  edges: Array<Edge> | null
}

function getCurrentCanvasNodes(nodesMap: Y.Map<Node>): Array<Node> {
  return sortCanvasElementsByZIndex(
    Array.from(nodesMap.values()).map(stripEphemeralCanvasNodeState),
  )
}

function getCurrentCanvasEdges(edgesMap: Y.Map<Edge>): Array<Edge> {
  return sortCanvasElementsByZIndex(Array.from(edgesMap.values()))
}

export function createCanvasReorderPlan(
  nodesMap: Y.Map<Node>,
  edgesMap: Y.Map<Edge>,
  selection: CanvasSelectionSnapshot,
  direction: CanvasReorderDirection,
): CanvasReorderPlan | null {
  const hasNodes = selection.nodeIds.length > 0
  const hasEdges = selection.edgeIds.length > 0
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
