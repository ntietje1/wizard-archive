import { ClientOnly } from '@tanstack/react-router'
import { Profiler } from 'react'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { dropTargetChromeClass } from '~/features/dnd/utils/drop-target-visual-state'
import { cn } from '~/features/shadcn/lib/utils'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import {
  isCanvasPerformanceEnabled,
  recordCanvasPerformanceMetric,
} from '../runtime/performance/canvas-performance-metrics'
import { CanvasContextMenuAdaptersContext } from '../runtime/context-menu/canvas-context-menu-adapters-context'
import { CanvasRuntimeProvider } from '../runtime/providers/canvas-runtime'
import { CanvasEngineProvider } from '../react/canvas-engine-context'
import { loadPersistedCanvasViewport } from '../runtime/interaction/canvas-viewport-storage'
import { useCanvasViewerSession } from '../runtime/session/use-canvas-viewer-session'
import { useCanvasEditorRuntime } from '../runtime/use-canvas-editor-runtime'
import { CanvasEditorSurface } from './canvas-editor-surface'
import { CanvasNodeContent } from './canvas-node-content'
import { useCanvasContextMenuAppAdapters } from './use-canvas-context-menu-app-adapters'
import type { CanvasViewerSession } from '../runtime/session/use-canvas-viewer-session'
import type { ViewerProps } from '~/shared/viewer/viewer-props'
import type { CanvasWithContent } from 'shared/canvases/types'

// React Profiler durations are milliseconds; this ignores trivial sampling noise.
const MIN_TRIVIAL_COMMIT_DURATION_MS = 1

export function CanvasViewer({ item: canvas }: ViewerProps<CanvasWithContent>) {
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
  const canvasEditorContent = (
    <CanvasEditorSurface
      canEdit={canEdit}
      canvasCursor={canvasCursor}
      canvasSurfaceRef={runtime.canvasSurfaceRef}
      contextMenu={runtime.contextMenu}
      NodeContentComponent={CanvasNodeContent}
      remoteUsers={runtime.remoteUsers}
      sceneHandlers={runtime.sceneHandlers}
      dropOverlay={
        <CanvasDropOverlay
          ref={runtime.dropTarget.dropOverlayRef}
          isDropTarget={runtime.dropTarget.isDropTarget}
          isFileDropTarget={runtime.dropTarget.isFileDropTarget}
        />
      }
    />
  )

  return (
    <CanvasEngineProvider engine={runtime.canvasEngine}>
      <CanvasRuntimeProvider
        canvasId={canvasId}
        canEdit={canEdit}
        commands={runtime.commands}
        documentWriter={runtime.documentWriter}
        domRuntime={runtime.domRuntime}
        editSession={runtime.editSession}
        history={runtime.history}
        nodeActions={runtime.nodeActions}
        provider={provider}
        remoteHighlights={runtime.remoteHighlights}
        selection={runtime.selection}
        viewportController={runtime.viewportController}
      >
        {isCanvasPerformanceEnabled() ? (
          <Profiler
            id="CanvasEditor"
            onRender={(_id, phase, actualDuration, baseDuration) => {
              if (actualDuration < MIN_TRIVIAL_COMMIT_DURATION_MS) {
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
