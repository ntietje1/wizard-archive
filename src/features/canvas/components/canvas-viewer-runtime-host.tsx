import { CanvasEditorRuntimeHost } from './canvas-editor-runtime-host'
import { CanvasNodeContent } from './canvas-node-content'
import type { CanvasViewerSource } from './canvas-viewer-source'
import type { ReadyCanvasDocumentSource } from '../runtime/session/canvas-document-source'
import type { ComponentProps, ReactNode } from 'react'

type CanvasViewerRuntime = ComponentProps<typeof CanvasEditorRuntimeHost>['runtime']

export function CanvasViewerRuntimeHost({
  dropOverlay,
  runtime,
  session,
  source,
}: {
  dropOverlay?: ReactNode
  runtime: CanvasViewerRuntime
  session: ReadyCanvasDocumentSource
  source: CanvasViewerSource
}) {
  return (
    <CanvasEditorRuntimeHost
      canvasId={session.canvasId}
      canEdit={session.canEdit}
      canvasCursor={runtime.toolCursor ?? 'pointer'}
      NodeContentComponent={CanvasNodeContent}
      EmbeddedCanvasStateResolver={source.EmbeddedCanvasStateResolver}
      EmbeddedMapStateResolver={source.EmbeddedMapStateResolver}
      EmbedTargetOperationsSource={source.EmbedTargetOperationsSource}
      provider={session.provider}
      runtime={runtime}
      SidebarItemEmbedResolver={source.SidebarItemEmbedResolver}
      dropOverlay={dropOverlay}
    />
  )
}
