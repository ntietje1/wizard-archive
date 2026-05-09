import { useCanvasDropTarget } from './use-canvas-drop-target'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasDocumentNode } from 'convex/canvases/validation'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'

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
