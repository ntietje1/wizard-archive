import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type * as Y from 'yjs'
import type { CanvasDocumentEdge } from '~/features/canvas/domain/canvas-document'

export function getCanvasDeletionSelection(
  edgesMap: Y.Map<CanvasDocumentEdge>,
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
