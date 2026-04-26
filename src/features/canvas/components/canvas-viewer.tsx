import { ClientOnly } from '@tanstack/react-router'
import { memo, Profiler, useMemo } from 'react'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { ContextMenuHost } from '~/features/context-menu/components/context-menu-host'
import { cn } from '~/features/shadcn/lib/utils'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import {
  isCanvasPerformanceEnabled,
  recordCanvasPerformanceMetric,
} from '../runtime/performance/canvas-performance-metrics'
import { CanvasRuntimeProvider } from '../runtime/providers/canvas-runtime-context'
import { CanvasEngineProvider } from '../react/canvas-engine-context'
import { useCanvasPendingSelectionPreviewSummary } from '../runtime/selection/use-canvas-pending-selection-preview'
import { loadPersistedCanvasViewport } from '../runtime/interaction/canvas-viewport-storage'
import { useCanvasViewerSession } from '../runtime/session/use-canvas-viewer-session'
import { useCanvasEditorRuntime } from '../runtime/use-canvas-editor-runtime'
import { CanvasConditionalToolbar } from './canvas-conditional-toolbar'
import { CanvasScene } from './canvas-scene'
import { CanvasToolbar } from './canvas-toolbar'
import type { CanvasViewerSession } from '../runtime/session/use-canvas-viewer-session'
import type { EditorViewerProps } from '~/features/editor/components/viewer/sidebar-item-editor'
import type { CanvasWithContent } from 'convex/canvases/types'

export function CanvasViewer({ item: canvas }: EditorViewerProps<CanvasWithContent>) {
  return (
    <ClientOnly fallback={null}>
      <CanvasViewerInner canvas={canvas} />
    </ClientOnly>
  )
}

function CanvasViewerInner({ canvas }: { canvas: CanvasWithContent }) {
  const session = useCanvasViewerSession(canvas)

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

type ReadyCanvasSession = Extract<CanvasViewerSession, { status: 'ready' }>

export function CanvasEditor({
  canvasId,
  campaignId,
  canEdit,
  parentId,
  provider,
  doc,
  nodesMap,
  edgesMap,
}: ReadyCanvasSession) {
  const initialViewport = useMemo(() => loadPersistedCanvasViewport(canvasId), [canvasId])
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
  const canvasEditorContent = (
    <CanvasEditorContent canEdit={canEdit} runtime={runtime} canvasCursor={canvasCursor} />
  )

  return (
    <CanvasEngineProvider engine={runtime.canvasEngine}>
      <CanvasRuntimeProvider
        canEdit={canEdit}
        canvasEngine={runtime.canvasEngine}
        history={runtime.history}
        commands={runtime.commands}
        documentWriter={runtime.documentWriter}
        domRuntime={runtime.domRuntime}
        editSession={runtime.editSession}
        nodeActions={runtime.nodeActions}
        nodeDragController={runtime.nodeDragController}
        viewportController={runtime.viewportController}
        remoteHighlights={runtime.remoteHighlights}
        selection={runtime.selection}
      >
        {isCanvasPerformanceEnabled() ? (
          <Profiler
            id="CanvasEditor"
            onRender={(_id, phase, actualDuration, baseDuration) => {
              if (actualDuration < 0.25) {
                return
              }

              recordCanvasPerformanceMetric('canvas.react.commit', actualDuration, {
                phase,
                baseDuration,
              })
            }}
          >
            {canvasEditorContent}
          </Profiler>
        ) : (
          canvasEditorContent
        )}
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>
  )
}

const CanvasEditorContent = memo(function CanvasEditorContent({
  canEdit,
  runtime,
  canvasCursor,
}: {
  canEdit: boolean
  runtime: ReturnType<typeof useCanvasEditorRuntime>
  canvasCursor: string
}) {
  const pendingSelectionPreview = useCanvasPendingSelectionPreviewSummary()

  return (
    <div
      className="canvas-editor-shell relative flex-1 min-h-0 allow-motion"
      style={{ cursor: canvasCursor }}
      data-testid="canvas-editor-shell"
    >
      <CanvasToolbar canEdit={canEdit} />
      <CanvasConditionalToolbar canEdit={canEdit} />
      <div
        ref={runtime.canvasSurfaceRef}
        className="relative h-full w-full"
        data-testid="canvas-surface"
        role="region"
        aria-label="Canvas surface"
      >
        <CanvasScene
          canEdit={canEdit}
          remoteUsers={runtime.remoteUsers}
          sceneHandlers={runtime.sceneHandlers}
          onNodeContextMenu={runtime.contextMenu.openForNode}
          onEdgeContextMenu={runtime.contextMenu.openForEdge}
          onPaneContextMenu={runtime.contextMenu.openForPane}
        />

        <ContextMenuHost
          ref={runtime.contextMenu.hostRef}
          menu={runtime.contextMenu.menu}
          onClose={runtime.contextMenu.onClose}
        />

        {pendingSelectionPreview.active &&
          pendingSelectionPreview.nodeCount + pendingSelectionPreview.edgeCount > 0 && (
            <CanvasPendingSelectionStatus
              nodeCount={pendingSelectionPreview.nodeCount}
              edgeCount={pendingSelectionPreview.edgeCount}
            />
          )}

        <CanvasDropOverlay
          ref={runtime.dropTarget.dropOverlayRef}
          isDropTarget={runtime.dropTarget.isDropTarget}
          isFileDropTarget={runtime.dropTarget.isFileDropTarget}
        />
      </div>
    </div>
  )
}, areCanvasEditorContentPropsEqual)

function areCanvasEditorContentPropsEqual(
  previous: {
    canEdit: boolean
    runtime: ReturnType<typeof useCanvasEditorRuntime>
    canvasCursor: string
  },
  next: {
    canEdit: boolean
    runtime: ReturnType<typeof useCanvasEditorRuntime>
    canvasCursor: string
  },
) {
  return (
    previous.canEdit === next.canEdit &&
    previous.canvasCursor === next.canvasCursor &&
    previous.runtime.canvasEngine === next.runtime.canvasEngine &&
    previous.runtime.canvasSurfaceRef === next.runtime.canvasSurfaceRef &&
    previous.runtime.contextMenu.hostRef === next.runtime.contextMenu.hostRef &&
    previous.runtime.contextMenu.menu === next.runtime.contextMenu.menu &&
    previous.runtime.dropTarget.dropOverlayRef === next.runtime.dropTarget.dropOverlayRef &&
    previous.runtime.dropTarget.isDropTarget === next.runtime.dropTarget.isDropTarget &&
    previous.runtime.dropTarget.isFileDropTarget === next.runtime.dropTarget.isFileDropTarget &&
    previous.runtime.remoteUsers === next.runtime.remoteUsers
  )
}

function CanvasPendingSelectionStatus({
  nodeCount,
  edgeCount,
}: {
  nodeCount: number
  edgeCount: number
}) {
  if (nodeCount === 0 && edgeCount === 0) {
    return null
  }

  const parts = [
    nodeCount > 0 ? `${nodeCount} node${nodeCount === 1 ? '' : 's'}` : null,
    edgeCount > 0 ? `${edgeCount} edge${edgeCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean)

  return (
    <div
      className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-full border bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      {`Selecting ${parts.join(', ')}`}
    </div>
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
        active && 'bg-ring/5 ring-2 ring-inset ring-ring/60',
      )}
    />
  )
}
CanvasDropOverlay.displayName = 'CanvasDropOverlay'
