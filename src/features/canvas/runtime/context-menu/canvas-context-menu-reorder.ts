import { reorderCanvasElementIds } from '../document/canvas-reorder'
import { applyCanvasZOrder } from '../document/canvas-z-order'
import { getCurrentCanvasEdges, getCurrentCanvasNodes } from './canvas-context-menu-elements'
import type { CanvasReorderDirection } from '../document/canvas-reorder'
import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

export interface CanvasReorderUpdates {
  nodes: Array<Node> | null
  edges: Array<Edge> | null
}

export function createCanvasReorderUpdates(
  nodesMap: Y.Map<Node>,
  edgesMap: Y.Map<Edge>,
  selection: CanvasSelectionSnapshot,
  direction: CanvasReorderDirection,
): CanvasReorderUpdates | null {
  const hasNodes = selection.nodeIds.length > 0
  const hasEdges = selection.edgeIds.length > 0
  if (!hasNodes && !hasEdges) {
    return null
  }

  const currentNodes = hasNodes ? getCurrentCanvasNodes(nodesMap) : null
  const currentEdges = hasEdges ? getCurrentCanvasEdges(edgesMap) : null
  const currentNodesArray = currentNodes ?? []
  const currentEdgesArray = currentEdges ?? []
  const currentNodeIds = currentNodesArray.map((node) => node.id)
  const currentEdgeIds = currentEdgesArray.map((edge) => edge.id)

  return {
    nodes: hasNodes
      ? applyCanvasZOrder(
          currentNodesArray,
          reorderCanvasElementIds(currentNodeIds, selection.nodeIds, direction),
        )
      : null,
    edges: hasEdges
      ? applyCanvasZOrder(
          currentEdgesArray,
          reorderCanvasElementIds(currentEdgeIds, selection.edgeIds, direction),
        )
      : null,
  }
}
