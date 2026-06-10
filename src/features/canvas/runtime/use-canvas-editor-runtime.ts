import type { Id } from 'convex/_generated/dataModel'
import { useCanvasEditorRuntimeCore } from './use-canvas-editor-runtime-core'
import { useCanvasDropIntegration } from './interaction/use-canvas-drop-integration'
import type { ConvexYjsProvider } from '~/shared/collaboration/convex-yjs-provider'
import { useYjsPreviewUpload } from '~/features/previews/hooks/use-yjs-preview-upload'
import type { UseCanvasEditorRuntimeCoreOptions } from './use-canvas-editor-runtime-core'

type UseCanvasEditorRuntimeOptions = UseCanvasEditorRuntimeCoreOptions & {
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  provider: ConvexYjsProvider | null
}

export function useCanvasEditorRuntime(options: UseCanvasEditorRuntimeOptions) {
  const runtime = useCanvasEditorRuntimeCore(options)
  const { canvasId, canEdit, doc, provider } = options

  useYjsPreviewUpload({
    itemId: canvasId,
    doc,
    containerRef: runtime.canvasSurfaceRef,
    resolveElement: (container) => container,
  })

  const dropTarget = useCanvasDropIntegration({
    canvasId,
    canEdit,
    isSelectMode: runtime.activeTool === 'select',
    createNodes: runtime.documentWriter.createNodes,
    provider,
    screenToCanvasPosition: runtime.viewportController.screenToCanvasPosition,
  })

  return {
    ...runtime,
    dropTarget,
  }
}
