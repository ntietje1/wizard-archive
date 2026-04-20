import { reorderCanvasElements } from '../document/canvas-stack-order'
import { getCurrentCanvasEdges, getCurrentCanvasNodes } from './canvas-context-menu-elements'
import type { CanvasReorderDirection } from '../document/canvas-stack-order'
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

  return {
    nodes: hasNodes
      ? reorderCanvasElements(getCurrentCanvasNodes(nodesMap), selection.nodeIds, direction)
      : null,
    edges: hasEdges
      ? reorderCanvasElements(getCurrentCanvasEdges(edgesMap), selection.edgeIds, direction)
      : null,
  }
}
