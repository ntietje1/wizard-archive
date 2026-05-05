import { useCanvasDropTarget } from './use-canvas-drop-target'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasDocumentNode } from 'convex/canvases/validation'

interface UseCanvasDropIntegrationOptions {
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  isSelectMode: boolean
  createNode: (node: CanvasDocumentNode) => void
  screenToCanvasPosition: (position: { x: number; y: number }) => { x: number; y: number }
}

export function useCanvasDropIntegration({
  canvasId,
  canEdit,
  isSelectMode,
  createNode,
  screenToCanvasPosition,
}: UseCanvasDropIntegrationOptions) {
  return useCanvasDropTarget({
    canvasId,
    enabled: canEdit && isSelectMode,
    createNode,
    screenToCanvasPosition,
  })
}
