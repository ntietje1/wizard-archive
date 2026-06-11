import { Profiler } from 'react'
import { CanvasRuntimeProvider } from '../runtime/providers/canvas-runtime'
import { CanvasEngineProvider } from '../react/canvas-engine-context'
import {
  isCanvasPerformanceEnabled,
  recordCanvasPerformanceMetric,
} from '../runtime/performance/canvas-performance-metrics'
import { CanvasEditorSurface } from './canvas-editor-surface'
import type { useCanvasEditorRuntimeCore } from '../runtime/use-canvas-editor-runtime-core'
import { EmbeddedCanvasStateResolutionProvider } from '~/features/embeds/context/embedded-canvas-state-resolution'
import type { EmbeddedCanvasStateResolver } from '~/features/embeds/context/embedded-canvas-state-resolution'
import { EmbeddedMapStateResolutionProvider } from '~/features/embeds/context/embedded-map-state-resolution'
import type { EmbeddedMapStateResolver } from '~/features/embeds/context/embedded-map-state-resolution'
import { EmbedSidebarItemResolutionProvider } from '~/features/embeds/context/embed-sidebar-item-resolution'
import type { EmbedSidebarItemResolver } from '~/features/embeds/context/embed-sidebar-item-resolution'
import { EmbedTargetOperationsProvider } from '~/features/embeds/context/embed-target-operations'
import type { ConvexYjsProvider } from '~/shared/collaboration/convex-yjs-provider'
import type { Id } from 'convex/_generated/dataModel'
import type { ComponentType, ReactNode } from 'react'

const MIN_TRIVIAL_COMMIT_DURATION_MS = 1

type CanvasEditorRuntimeHostRuntime = ReturnType<typeof useCanvasEditorRuntimeCore>

export function CanvasEditorRuntimeHost({
  canEdit,
  canvasCursor,
  canvasId,
  dropOverlay,
  NodeContentComponent,
  EmbeddedCanvasStateResolver,
  EmbeddedMapStateResolver,
  EmbedTargetOperationsSource,
  provider,
  runtime,
  SidebarItemEmbedResolver,
}: {
  canEdit: boolean
  canvasCursor: string
  canvasId: Id<'sidebarItems'>
  dropOverlay?: ReactNode
  EmbeddedCanvasStateResolver?: EmbeddedCanvasStateResolver
  EmbeddedMapStateResolver?: EmbeddedMapStateResolver
  EmbedTargetOperationsSource?: ComponentType<{ children: ReactNode }>
  NodeContentComponent: ComponentType<{ nodeId: string }>
  provider?: ConvexYjsProvider | null
  runtime: CanvasEditorRuntimeHostRuntime
  SidebarItemEmbedResolver?: EmbedSidebarItemResolver
}) {
  const canvasEditorContent = (
    <CanvasEditorSurface
      canEdit={canEdit}
      canvasCursor={canvasCursor}
      canvasSurfaceRef={runtime.canvasSurfaceRef}
      contextMenu={runtime.contextMenu}
      NodeContentComponent={NodeContentComponent}
      remoteUsers={runtime.remoteUsers}
      sceneHandlers={runtime.sceneHandlers}
      dropOverlay={dropOverlay}
    />
  )

  return (
    <EmbedSidebarItemResolutionProvider resolver={SidebarItemEmbedResolver}>
      <EmbedTargetOperationsSourceBoundary Source={EmbedTargetOperationsSource}>
        <EmbeddedCanvasStateResolutionProvider resolver={EmbeddedCanvasStateResolver}>
          <EmbeddedMapStateResolutionProvider resolver={EmbeddedMapStateResolver}>
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
                provider={provider ?? null}
                remoteHighlights={runtime.remoteHighlights}
                selection={runtime.selection}
                viewportController={runtime.viewportController}
              >
                {isCanvasPerformanceEnabled() ? (
                  <Profiler
                    id="CanvasEditor"
                    onRender={(_id, phase, actualDuration, baseDuration) => {
                      if (actualDuration < MIN_TRIVIAL_COMMIT_DURATION_MS) return

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
          </EmbeddedMapStateResolutionProvider>
        </EmbeddedCanvasStateResolutionProvider>
      </EmbedTargetOperationsSourceBoundary>
    </EmbedSidebarItemResolutionProvider>
  )
}

function EmbedTargetOperationsSourceBoundary({
  children,
  Source,
}: {
  children: ReactNode
  Source?: ComponentType<{ children: ReactNode }>
}) {
  if (Source) {
    return <Source>{children}</Source>
  }

  return <EmbedTargetOperationsProvider>{children}</EmbedTargetOperationsProvider>
}
