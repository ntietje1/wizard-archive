import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'
import type { Edge } from '@xyflow/react'
import type * as Y from 'yjs'

export function getCanvasDeletionSelection(
  edgesMap: Y.Map<Edge>,
  selection: CanvasSelectionSnapshot,
): CanvasSelectionSnapshot {
  if (selection.nodeIds.size === 0) {
    return selection
  }

  const edgeIds = new Set(selection.edgeIds)
  for (const edge of edgesMap.values()) {
    if (selection.nodeIds.has(edge.source) || selection.nodeIds.has(edge.target)) {
      edgeIds.add(edge.id)
    }
  }

  return {
    nodeIds: selection.nodeIds,
    edgeIds,
  }
}
