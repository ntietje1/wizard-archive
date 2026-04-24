import { areStringSetsEqual } from '../../utils/canvas-selection-utils'
import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'

interface CanvasPendingSelectionPreviewSelection {
  nodeIds: ReadonlySet<string>
  edgeIds: ReadonlySet<string>
}

export type CanvasPendingSelectionPreviewActive = {
  kind: 'active'
} & CanvasPendingSelectionPreviewSelection

export type CanvasPendingSelectionPreview =
  | { kind: 'inactive' }
  | CanvasPendingSelectionPreviewActive

export function createInactiveCanvasPendingSelectionPreview(): CanvasPendingSelectionPreview {
  return { kind: 'inactive' }
}

export function createCanvasPendingSelectionPreview(
  preview: CanvasSelectionSnapshot | null,
): CanvasPendingSelectionPreview {
  if (preview === null) {
    return createInactiveCanvasPendingSelectionPreview()
  }

  return {
    kind: 'active',
    nodeIds: new Set(preview.nodeIds),
    edgeIds: new Set(preview.edgeIds),
  }
}

export function getNextCanvasPendingSelectionPreview(
  current: CanvasPendingSelectionPreview,
  next: CanvasPendingSelectionPreview,
): CanvasPendingSelectionPreview {
  if (current.kind === 'inactive' || next.kind === 'inactive') {
    return current.kind === next.kind ? current : next
  }

  return areStringSetsEqual(current.nodeIds, next.nodeIds) &&
    areStringSetsEqual(current.edgeIds, next.edgeIds)
    ? current
    : next
}

export function isCanvasPendingPreviewActive(
  preview: CanvasPendingSelectionPreview,
): preview is CanvasPendingSelectionPreviewActive {
  return preview.kind === 'active'
}

export function isCanvasNodePendingPreview(
  preview: CanvasPendingSelectionPreview,
  id: string,
): boolean {
  return preview.kind === 'active' && preview.nodeIds.has(id)
}

export function isCanvasEdgePendingPreview(
  preview: CanvasPendingSelectionPreview,
  id: string,
): boolean {
  return preview.kind === 'active' && preview.edgeIds.has(id)
}

export function getCanvasPendingSelectionPreviewSummary(preview: CanvasPendingSelectionPreview): {
  active: boolean
  nodeCount: number
  edgeCount: number
} {
  if (preview.kind === 'inactive') {
    return {
      active: false,
      nodeCount: 0,
      edgeCount: 0,
    }
  }

  return {
    active: true,
    nodeCount: preview.nodeIds.size,
    edgeCount: preview.edgeIds.size,
  }
}
