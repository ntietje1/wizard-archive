import { useCanvasContextMenuAppAdapters } from './use-canvas-context-menu-app-adapters'
import { LiveEmbeddedCanvasStateResolver } from '~/features/embeds/components/live-embedded-canvas-state-resolver'
import { LiveEmbeddedMapStateResolver } from '~/features/embeds/components/live-embedded-map-state-resolver'
import { LiveEmbedTargetOperationsProvider } from '~/features/embeds/components/live-embed-target-operations-provider'
import { LiveSidebarItemEmbedResolver } from '~/features/embeds/components/live-sidebar-item-embed-resolver'
import { useLiveCanvasDocumentSource } from '../runtime/session/use-live-canvas-document-source'
import { LiveCanvasViewerRuntime } from './live-canvas-viewer-runtime'
import { CanvasViewerSession } from './canvas-viewer'
import { createElement } from 'react'
import type { CanvasViewerSource, CanvasViewerSourceComponentProps } from './canvas-viewer-source'

export const LIVE_CANVAS_VIEWER_SOURCE: CanvasViewerSource = {
  SourceComponent: LiveCanvasViewerSourceComponent,
  RuntimeComponent: LiveCanvasViewerRuntime,
  EmbeddedCanvasStateResolver: LiveEmbeddedCanvasStateResolver,
  EmbeddedMapStateResolver: LiveEmbeddedMapStateResolver,
  EmbedTargetOperationsSource: LiveEmbedTargetOperationsProvider,
  SidebarItemEmbedResolver: LiveSidebarItemEmbedResolver,
}

function LiveCanvasViewerSourceComponent({ canvas, source }: CanvasViewerSourceComponentProps) {
  const session = useLiveCanvasDocumentSource(canvas)
  const contextMenuSource = useCanvasContextMenuAppAdapters({
    campaignId: session.status === 'ready' ? session.campaignId : canvas.campaignId,
    canvasParentId: session.status === 'ready' ? session.parentId : canvas.parentId,
  })

  return createElement(CanvasViewerSession, {
    contextMenuSource: session.status === 'ready' ? contextMenuSource : undefined,
    session,
    source,
  })
}
