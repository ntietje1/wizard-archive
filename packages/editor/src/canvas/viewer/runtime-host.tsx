import { CanvasEditorRuntimeHost } from '../components/canvas-editor-runtime-host'
import { CanvasNodeContent } from '../components/canvas-node-content'
import type { CanvasCollaborationProvider, CanvasDocumentSession } from '../session-contract'
import type { ComponentProps, ReactNode } from 'react'
import type { CanvasViewerContentSource } from './source'
import { EmbeddedMapStateSourceProvider } from '../../game-maps/embedded-state-context'

type CanvasEditorRuntime = ComponentProps<typeof CanvasEditorRuntimeHost>['runtime']

export function CanvasViewerRuntimeHost({
  dropOverlay,
  runtime,
  provider,
  session,
  source,
}: {
  dropOverlay?: ReactNode
  runtime: CanvasEditorRuntime
  provider: CanvasCollaborationProvider | null
  session: Extract<CanvasDocumentSession, { status: 'ready' }>
  source: CanvasViewerContentSource
}) {
  return (
    <EmbeddedMapStateSourceProvider source={source.embedResolution}>
      <CanvasEditorRuntimeHost
        canvasId={session.canvasId}
        canEdit={session.canEdit}
        canvasCursor={runtime.toolCursor ?? 'pointer'}
        NodeContentComponent={CanvasNodeContent}
        isSidebarItemEmbedRichTextEditable={source.isSidebarItemEmbedRichTextEditable}
        noteDocumentSource={source.noteDocumentSource}
        noteEmbeddedNoteContentSource={source.noteEmbeddedNoteContentSource}
        noteEmbedTargetSource={source.noteEmbedTargetSource}
        noteLinkCreationSource={source.noteLinkCreationSource}
        noteLinkNavigationSource={source.noteLinkNavigationSource}
        noteLinkResolutionSource={source.noteLinkResolutionSource}
        notePlaybackSource={source.notePlaybackSource}
        notePermissionSource={source.notePermissionSource}
        noteSharingSource={source.noteSharingSource}
        noteValueReferences={source.noteValueReferences}
        noteValueStateSource={source.noteValueStateSource}
        noteWikiLinkSource={source.noteWikiLinkSource}
        provider={provider}
        runtime={runtime}
        dropOverlay={dropOverlay}
      />
    </EmbeddedMapStateSourceProvider>
  )
}
