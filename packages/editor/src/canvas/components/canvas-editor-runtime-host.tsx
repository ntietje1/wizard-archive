import type { ResourceId } from '../../resources/domain-id'
import { Profiler } from 'react'
import { CanvasRuntimeProvider } from '../runtime/providers/canvas-runtime'
import { CanvasEngineProvider } from '../react/canvas-engine-context'
import { CanvasRenderModeContext } from '../runtime/providers/canvas-render-mode-context'
import {
  isCanvasPerformanceEnabled,
  recordCanvasPerformanceMetric,
} from '../runtime/performance/canvas-performance-metrics'
import { CanvasEditorSurface } from './canvas-editor-surface'
import type { useCanvasEditorRuntimeCore } from '../runtime/use-canvas-editor-runtime-core'

import type { ComponentType, ReactNode } from 'react'
import type { CanvasCollaborationProvider } from '../session-contract'
import type { CanvasNoteContentSources } from '../note-content-sources'

const MIN_TRIVIAL_COMMIT_DURATION_MS = 1

type CanvasEditorRuntimeHostRuntime = ReturnType<typeof useCanvasEditorRuntimeCore>

export function CanvasEditorRuntimeHost({
  canEdit,
  canvasCursor,
  canvasId,
  dropOverlay,
  NodeContentComponent,
  isSidebarItemEmbedRichTextEditable,
  noteDocumentSource,
  noteEmbeddedNoteContentSource,
  noteEmbedTargetSource,
  noteLinkCreationSource,
  noteLinkNavigationSource,
  noteLinkResolutionSource,
  notePlaybackSource,
  notePermissionSource,
  noteSharingSource,
  noteValueReferences,
  noteValueStateSource,
  noteWikiLinkSource,
  provider,
  runtime,
}: {
  canEdit: boolean
  canvasCursor: string
  canvasId: ResourceId
  dropOverlay?: ReactNode
  isSidebarItemEmbedRichTextEditable: (itemId: ResourceId) => boolean
  NodeContentComponent: ComponentType<{ nodeId: string }>
  provider?: CanvasCollaborationProvider | null
  runtime: CanvasEditorRuntimeHostRuntime
} & CanvasNoteContentSources) {
  const canvasWorkspaceRuntimeContent = (
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
    <CanvasEngineProvider engine={runtime.canvasEngine}>
      <CanvasRenderModeContext.Provider value="interactive">
        <CanvasRuntimeProvider
          canvasId={canvasId}
          canEdit={canEdit}
          commands={runtime.commands}
          documentWriter={runtime.documentWriter}
          domRuntime={runtime.domRuntime}
          editSession={runtime.editSession}
          history={runtime.history}
          isSidebarItemEmbedRichTextEditable={isSidebarItemEmbedRichTextEditable}
          noteDocumentSource={noteDocumentSource}
          noteEmbeddedNoteContentSource={noteEmbeddedNoteContentSource}
          noteEmbedTargetSource={noteEmbedTargetSource}
          noteLinkCreationSource={noteLinkCreationSource}
          noteLinkNavigationSource={noteLinkNavigationSource}
          noteLinkResolutionSource={noteLinkResolutionSource}
          notePlaybackSource={notePlaybackSource}
          notePermissionSource={notePermissionSource}
          noteSharingSource={noteSharingSource}
          noteValueReferences={noteValueReferences}
          noteValueStateSource={noteValueStateSource}
          noteWikiLinkSource={noteWikiLinkSource}
          nodeActions={runtime.nodeActions}
          provider={provider ?? null}
          remoteNodeHighlights={runtime.remoteNodeHighlights}
          remoteEdgeHighlights={runtime.remoteEdgeHighlights}
          selection={runtime.selection}
          localOverlayStore={runtime.localOverlayStore}
          toolStore={runtime.toolStore}
          viewportController={runtime.viewportController}
        >
          {isCanvasPerformanceEnabled() ? (
            <Profiler
              id="CanvasEditor"
              onRender={(_, phase, actualDuration, baseDuration) => {
                if (actualDuration < MIN_TRIVIAL_COMMIT_DURATION_MS) return

                recordCanvasPerformanceMetric('canvas.react.commit', actualDuration, {
                  phase,
                  baseDuration,
                })
              }}
            >
              {canvasWorkspaceRuntimeContent}
            </Profiler>
          ) : (
            canvasWorkspaceRuntimeContent
          )}
        </CanvasRuntimeProvider>
      </CanvasRenderModeContext.Provider>
    </CanvasEngineProvider>
  )
}
