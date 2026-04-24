import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'
import type { Edge } from '@xyflow/react'
import type * as Y from 'yjs'

export function getCanvasDeletionSelection(
  edgesMap: Y.Map<Edge>,
  selection: CanvasSelectionSnapshot,
): CanvasSelectionSnapshot {
  if (selection.nodeIds.length === 0) {
    return selection
  }

  const nodeIdSet = new Set(selection.nodeIds)
  const edgeIds = new Set(selection.edgeIds)
  for (const edge of edgesMap.values()) {
    if (nodeIdSet.has(edge.source) || nodeIdSet.has(edge.target)) {
      edgeIds.add(edge.id)
    }
  }

  return {
    nodeIds: selection.nodeIds,
    edgeIds: [...edgeIds],
  }
}
