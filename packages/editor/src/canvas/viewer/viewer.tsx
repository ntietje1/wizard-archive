import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'
import { ClientOnly } from '@wizard-archive/ui/components/client-only'
import type { CanvasDocumentSession } from '../session-contract'
import type { CanvasItemWithContent } from '../item-contract'
import { useCanvasEditorRuntimeCore } from '../runtime/use-canvas-editor-runtime-core'
import { CanvasViewerRuntimeHost } from './runtime-host'
import { useDndStore } from '../../drag-drop/store'
import { dropTargetChromeClass } from '@wizard-archive/ui/drag-drop/drop-target-visual-state'
import { useCanvasDropTarget } from './use-drop-target'
import { useYjsElementPreviewUpload } from '../../previews/use-yjs-element-upload'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { getClientErrorMessage } from '../../../../../shared/errors/client'
import type { CanvasContextMenuSource } from '../runtime/context-menu/canvas-context-menu-types'
import type { CanvasViewerContentSource } from './source'

type CanvasViewerProps = {
  item: CanvasItemWithContent
  source: CanvasViewerContentSource
}

export function CanvasViewer({ item: canvas, source }: CanvasViewerProps) {
  return (
    <ClientOnly fallback={null}>
      <CanvasViewerContentSession canvas={canvas} source={source} />
    </ClientOnly>
  )
}

function CanvasViewerContentSession({
  canvas,
  source,
}: {
  canvas: CanvasItemWithContent
  source: CanvasViewerContentSource
}) {
  const session = useCanvasViewerDocumentSession(source, canvas)

  return <CanvasViewerResolvedSession session={session} source={source} />
}

function useCanvasViewerDocumentSession(
  source: CanvasViewerContentSource,
  canvas: CanvasItemWithContent,
) {
  return source.useCanvasDocumentSession(canvas)
}

function CanvasViewerResolvedSession({
  session,
  source,
}: {
  session: CanvasDocumentSession
  source: CanvasViewerContentSource
}) {
  const contextMenuSource = source.resolveContextMenuSource({
    session,
  })

  return (
    <CanvasViewerSession contextMenuSource={contextMenuSource} session={session} source={source} />
  )
}

function CanvasViewerSession({
  contextMenuSource,
  session,
  source,
}: {
  contextMenuSource: CanvasContextMenuSource | undefined
  session: CanvasDocumentSession
  source: CanvasViewerContentSource
}) {
  if (session.status === 'error') {
    const message =
      getClientErrorMessage(session.error) ??
      'Failed to load canvas. Please try refreshing the page.'

    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
        <p>{message}</p>
      </div>
    )
  }

  if (session.status === 'loading') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <ReadyCanvasViewerSession
      contextMenuSource={contextMenuSource}
      session={session}
      source={source}
    />
  )
}

function ReadyCanvasViewerSession({
  contextMenuSource,
  session,
  source,
}: {
  contextMenuSource: CanvasContextMenuSource | undefined
  session: Extract<CanvasDocumentSession, { status: 'ready' }>
  source: CanvasViewerContentSource
}) {
  const initialViewport = source.viewportStore.loadCanvasViewport(session.canvasId)
  const provider =
    session.collaboration.status === 'available' ? session.collaboration.provider : null
  const runtime = useCanvasEditorRuntimeCore({
    nodesMap: session.nodesMap,
    edgesMap: session.edgesMap,
    canvasId: session.canvasId,
    canEdit: session.canEdit,
    contextMenuSource,
    provider,
    doc: session.doc,
    initialViewport,
    viewportStore: source.viewportStore,
  })
  const uploadFile = source.noteEmbedTargetSource.embedTargetOperations?.uploadFile
  useYjsElementPreviewUpload({
    itemId: session.canvasId,
    doc: session.doc,
    containerRef: runtime.canvasSurfaceRef,
    enabled: session.canEdit,
    previewUpload: source.previewUpload,
    resolveElement: (container) => container,
  })
  const dropTarget = useCanvasDropTarget({
    canvasId: session.canvasId,
    createNodes: runtime.documentWriter.createNodes,
    patchNodeData: runtime.documentWriter.patchNodeData,
    enabled: session.canEdit,
    provider,
    screenToCanvasPosition: runtime.viewportController.screenToCanvasPosition,
    uploadFile,
  })

  return (
    <CanvasViewerRuntimeHost
      runtime={runtime}
      provider={provider}
      session={session}
      source={source}
      dropOverlay={
        dropTarget.enabled ? (
          <CanvasDropOverlay
            ref={dropTarget.dropOverlayRef}
            isDropTarget={dropTarget.isDropTarget}
            isFileDropTarget={dropTarget.isFileDropTarget}
          />
        ) : undefined
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
