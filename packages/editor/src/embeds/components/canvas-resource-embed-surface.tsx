import type { ReactElement } from 'react'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { AnyItem, AnyItemWithContent } from '../../workspace/items'
import type { PendingRichEmbedActivationRef } from '../../rich-text/deferred-activation'
import { EmbedNoteContent } from '../../notes/embeds/canvas-note-content'
import { EmbeddedCanvasContent } from './embedded-canvas-content'
import { EmbeddedMapContent } from './embedded-map-content'
import { ResourcePreviewSurface } from '../../previews/resource-preview-surface'
import type { ResourcePreviewRenderer } from '../../previews/resource-preview-surface'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import type { CustomBlockNoteEditor } from '../../notes/editor-schema'
import type { EmbedMediaLayoutReporter } from '../utils/media'
import type { CanvasNoteContentSources } from '../../canvas/note-content-sources'

export function CanvasResourceEmbedSurface({
  allowInnerScroll = true,
  isEditing,
  isExclusivelySelected,
  interactiveRenderMode,
  item,
  folderChildren,
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
  onActivated,
  onEditorChange,
  onMediaLayout,
  pendingActivationRef,
  textColor,
}: {
  item: AnyItemWithContent
  allowInnerScroll?: boolean
  isEditing: boolean
  isExclusivelySelected: boolean
  interactiveRenderMode: boolean
  folderChildren?: Array<AnyItem>
  onActivated: () => void
  onEditorChange: (editor: CustomBlockNoteEditor | null) => void
  onMediaLayout?: EmbedMediaLayoutReporter
  pendingActivationRef: PendingRichEmbedActivationRef
  textColor: string | null
} & CanvasNoteContentSources) {
  const renderPreview: ResourcePreviewRenderer = (input) => {
    switch (input.kind) {
      case 'note':
        return (
          <EmbedNoteContent
            note={input.item}
            editable={isEditing}
            isExclusivelySelected={isExclusivelySelected}
            onActivated={onActivated}
            onCanvasEditorChange={onEditorChange}
            pendingActivationRef={pendingActivationRef}
            documentSource={noteDocumentSource}
            embeddedNoteContentSource={noteEmbeddedNoteContentSource}
            embedTargetSource={noteEmbedTargetSource}
            linkCreationSource={noteLinkCreationSource}
            linkNavigationSource={noteLinkNavigationSource}
            linkResolutionSource={noteLinkResolutionSource}
            noteValueReferences={noteValueReferences}
            noteValueStateSource={noteValueStateSource}
            permissionSource={notePermissionSource}
            playbackSource={notePlaybackSource}
            sharingSource={noteSharingSource}
            textColor={textColor}
            wikiLinkSource={noteWikiLinkSource}
          />
        )
      case 'canvas':
        return interactiveRenderMode ? (
          <EmbeddedCanvasContent
            canvasId={input.item.id}
            previewUrl={input.item.previewUrl}
            alt={input.item.name}
          />
        ) : undefined
      case 'map':
        return interactiveRenderMode ? (
          <EmbeddedMapContent map={input.item} onMediaLayout={onMediaLayout} />
        ) : undefined
    }
  }
  const surface = (
    <ResourcePreviewSurface
      item={item}
      allowInnerScroll={allowInnerScroll}
      fillAvailableHeight={!interactiveRenderMode}
      folderChildren={folderChildren}
      mode="embed"
      onMediaLayout={onMediaLayout}
      renderPreview={renderPreview}
    />
  )

  if (isStaticCanvasOrMapEmbed(item, interactiveRenderMode)) {
    return <StaticResourceEmbedPreview>{surface}</StaticResourceEmbedPreview>
  }

  if (item.type === RESOURCE_TYPES.folders) {
    return (
      <div
        className={cn(
          'h-full overflow-hidden',
          interactiveRenderMode && isExclusivelySelected && 'nowheel',
        )}
      >
        {surface}
      </div>
    )
  }

  return surface
}

function isStaticCanvasOrMapEmbed(
  item: AnyItemWithContent,
  interactiveRenderMode: boolean,
): boolean {
  return (
    !interactiveRenderMode &&
    (item.type === RESOURCE_TYPES.canvases || item.type === RESOURCE_TYPES.gameMaps)
  )
}

function StaticResourceEmbedPreview({ children }: { children: ReactElement }) {
  return (
    <div
      data-testid="static-resource-embed-preview"
      className="h-full overflow-hidden pointer-events-none"
    >
      {children}
    </div>
  )
}
