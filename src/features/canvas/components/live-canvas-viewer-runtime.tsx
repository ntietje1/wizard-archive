import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { dropTargetChromeClass } from '~/features/dnd/utils/drop-target-visual-state'
import { cn } from '~/features/shadcn/lib/utils'
import { loadPersistedCanvasViewport } from '../runtime/interaction/canvas-viewport-storage'
import { useCanvasEditorRuntime } from '../runtime/use-canvas-editor-runtime'
import { CanvasViewerRuntimeHost } from './canvas-viewer-runtime-host'
import type { CanvasViewerRuntimeProps } from './canvas-viewer-source'

export function LiveCanvasViewerRuntime({
  contextMenuSource,
  session,
  source,
}: CanvasViewerRuntimeProps) {
  const initialViewport = loadPersistedCanvasViewport(session.canvasId)
  const runtime = useCanvasEditorRuntime({
    nodesMap: session.nodesMap,
    edgesMap: session.edgesMap,
    canvasId: session.canvasId,
    canEdit: session.canEdit,
    contextMenuSource,
    provider: session.provider,
    doc: session.doc,
    initialViewport,
  })

  return (
    <CanvasViewerRuntimeHost
      runtime={runtime}
      session={session}
      source={source}
      dropOverlay={
        <CanvasDropOverlay
          ref={runtime.dropTarget.dropOverlayRef}
          isDropTarget={runtime.dropTarget.isDropTarget}
          isFileDropTarget={runtime.dropTarget.isFileDropTarget}
        />
      }
    />
  )
}

const CanvasDropOverlay = ({
  ref,
  isDropTarget,
  isFileDropTarget,
}: {
  ref: React.Ref<HTMLDivElement>
  isDropTarget: boolean
  isFileDropTarget: boolean
}) => {
  const isDragging = useDndStore((state) => state.isDraggingElement || state.isDraggingFiles)
  const active = isDropTarget || isFileDropTarget

  return (
    <div
      ref={ref}
      className={cn(
        'absolute inset-0 z-[4]',
        isDragging ? 'pointer-events-auto' : 'pointer-events-none',
        active && dropTargetChromeClass(isFileDropTarget ? 'file' : 'default'),
      )}
    />
  )
}
CanvasDropOverlay.displayName = 'CanvasDropOverlay'
