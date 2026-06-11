import { loadPersistedCanvasViewport } from '../runtime/interaction/canvas-viewport-storage'
import { useCanvasEditorRuntimeCore } from '../runtime/use-canvas-editor-runtime-core'
import { CanvasViewerRuntimeHost } from './canvas-viewer-runtime-host'
import type { CanvasViewerRuntimeProps } from './canvas-viewer-source'

export function LocalCanvasViewerRuntime({
  contextMenuSource,
  session,
  source,
}: CanvasViewerRuntimeProps) {
  const initialViewport = loadPersistedCanvasViewport(session.canvasId)
  const runtime = useCanvasEditorRuntimeCore({
    nodesMap: session.nodesMap,
    edgesMap: session.edgesMap,
    canvasId: session.canvasId,
    canEdit: session.canEdit,
    contextMenuSource,
    provider: session.provider,
    doc: session.doc,
    initialViewport,
  })

  return <CanvasViewerRuntimeHost runtime={runtime} session={session} source={source} />
}
