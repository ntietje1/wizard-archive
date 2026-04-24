import { useCanvasDropTarget } from './use-canvas-drop-target'
import type { Id } from 'convex/_generated/dataModel'
import type { Node } from '@xyflow/react'

interface UseCanvasDropIntegrationOptions {
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  isSelectMode: boolean
  createNode: (node: Node) => void
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }
}

export function useCanvasDropIntegration({
  canvasId,
  canEdit,
  isSelectMode,
  createNode,
  screenToFlowPosition,
}: UseCanvasDropIntegrationOptions) {
  return useCanvasDropTarget({
    canvasId,
    enabled: canEdit && isSelectMode,
    createNode,
    screenToFlowPosition,
  })
}
