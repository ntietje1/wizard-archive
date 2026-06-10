import { ClientOnly } from '@tanstack/react-router'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { dropTargetChromeClass } from '~/features/dnd/utils/drop-target-visual-state'
import { cn } from '~/features/shadcn/lib/utils'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { CanvasContextMenuAdaptersContext } from '../runtime/context-menu/canvas-context-menu-adapters-context'
import { loadPersistedCanvasViewport } from '../runtime/interaction/canvas-viewport-storage'
import { useLiveCanvasDocumentSource } from '../runtime/session/use-live-canvas-document-source'
import { useCanvasEditorRuntime } from '../runtime/use-canvas-editor-runtime'
import { CanvasEditorRuntimeHost } from './canvas-editor-runtime-host'
import { CanvasNodeContent } from './canvas-node-content'
import { useCanvasContextMenuAppAdapters } from './use-canvas-context-menu-app-adapters'
import { LiveEmbeddedCanvasStateResolver } from '../nodes/embed/live-embedded-canvas-state-resolver'
import { LiveEmbeddedMapStateResolver } from '../nodes/embed/live-embedded-map-state-resolver'
import { LiveEmbedTargetOperationsProvider } from '~/features/embeds/components/live-embed-target-operations-provider'
import { LiveSidebarItemEmbedResolver } from '~/features/embeds/components/live-sidebar-item-embed-resolver'
import type { CanvasDocumentSource } from '../runtime/session/use-live-canvas-document-source'
import type { ViewerProps } from '~/shared/viewer/viewer-props'
import type { CanvasWithContent } from 'shared/canvases/types'

export function CanvasViewer({ item: canvas }: ViewerProps<CanvasWithContent>) {
  return (
    <ClientOnly fallback={null}>
      <CanvasViewerInner canvas={canvas} />
    </ClientOnly>
  )
}

function CanvasViewerInner({ canvas }: { canvas: CanvasWithContent }) {
  const session = useLiveCanvasDocumentSource(canvas)

  if (session.status === 'error') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
        <p>
          {typeof session.error === 'string'
            ? session.error
            : session.error?.message || 'Failed to load canvas. Please try refreshing the page.'}
        </p>
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

  return <CanvasEditor {...session} />
}

type ReadyCanvasSession = Extract<CanvasDocumentSource, { status: 'ready' }>

function CanvasEditor(session: ReadyCanvasSession) {
  const contextMenuAdapters = useCanvasContextMenuAppAdapters()

  return (
    <CanvasContextMenuAdaptersContext.Provider value={contextMenuAdapters}>
      <CanvasEditorRuntime {...session} />
    </CanvasContextMenuAdaptersContext.Provider>
  )
}

function CanvasEditorRuntime({
  canvasId,
  campaignId,
  canEdit,
  parentId,
  provider,
  doc,
  nodesMap,
  edgesMap,
}: ReadyCanvasSession) {
  const initialViewport = loadPersistedCanvasViewport(canvasId)
  const runtime = useCanvasEditorRuntime({
    nodesMap,
    edgesMap,
    canvasId,
    campaignId,
    canvasParentId: parentId,
    canEdit,
    provider,
    doc,
    initialViewport,
  })
  const canvasCursor = runtime.toolCursor ?? 'pointer'
  return (
    <CanvasEditorRuntimeHost
      canvasId={canvasId}
      canEdit={canEdit}
      canvasCursor={canvasCursor}
      NodeContentComponent={CanvasNodeContent}
      EmbeddedCanvasStateResolver={LiveEmbeddedCanvasStateResolver}
      EmbeddedMapStateResolver={LiveEmbeddedMapStateResolver}
      EmbedTargetOperationsSource={LiveEmbedTargetOperationsProvider}
      provider={provider}
      runtime={runtime}
      SidebarItemEmbedResolver={LiveSidebarItemEmbedResolver}
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
