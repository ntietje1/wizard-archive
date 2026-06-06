import { useCanvasDropTarget } from './use-canvas-drop-target'
import type { Id } from 'convex/_generated/dataModel'
import type { ConvexYjsProvider } from '~/shared/collaboration/convex-yjs-provider'
import type { CanvasDocumentNode } from '~/features/canvas/domain/canvas-document'

interface UseCanvasDropIntegrationOptions {
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  isSelectMode: boolean
  createNodes: (nodes: ReadonlyArray<CanvasDocumentNode>) => void
  provider: ConvexYjsProvider | null
  screenToCanvasPosition: (position: { x: number; y: number }) => { x: number; y: number }
}

export function useCanvasDropIntegration({
  canvasId,
  canEdit,
  isSelectMode,
  createNodes,
  provider,
  screenToCanvasPosition,
}: UseCanvasDropIntegrationOptions) {
  return useCanvasDropTarget({
    canvasId,
    enabled: canEdit && isSelectMode,
    createNodes,
    provider,
    screenToCanvasPosition,
  })
}
