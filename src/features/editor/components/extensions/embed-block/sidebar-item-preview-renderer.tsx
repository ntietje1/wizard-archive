import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { CanvasThumbnailPreview } from '~/features/previews/components/canvas-thumbnail-preview'
import { FileMediaEmbedContent } from '~/features/previews/components/file-media-embed-content'
import { FolderListContentSimple } from '~/features/editor/components/viewer/folder/folder-list-content-simple'
import { MapImagePreview } from '~/features/editor/components/viewer/map/map-image-preview'
import { RawNoteContent } from '~/features/editor/components/raw-note-content'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { assertNever } from '~/shared/utils/utils'
import type { EmbedMediaLayoutReporter } from '~/features/embeds/utils/embed-media'

type SidebarItemPreviewRendererProps = {
  item: AnySidebarItemWithContent
  allowInnerScroll?: boolean
  onMediaLayout?: EmbedMediaLayoutReporter
}

export function SidebarItemPreviewRenderer({
  item,
  allowInnerScroll = false,
  onMediaLayout,
}: SidebarItemPreviewRendererProps) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return (
        <ScrollArea
          className="canvas-rich-text-editor h-full pt-2"
          contentClassName="note-editor-scroll-content"
          data-embedded-note-mode="readonly"
          data-testid="embed-note-content-wrapper"
          scrollOrientation={allowInnerScroll ? 'vertical' : 'none'}
          viewportStyle={!allowInnerScroll ? { overflowY: 'hidden' } : undefined}
        >
          <RawNoteContent content={item.content} editable={false} fillHeight noteId={item._id} />
        </ScrollArea>
      )
    case SIDEBAR_ITEM_TYPES.files:
      return (
        <FileMediaEmbedContent
          downloadUrl={item.downloadUrl}
          contentType={item.contentType}
          previewUrl={item.previewUrl}
          name={item.name}
          allowInnerScroll={allowInnerScroll}
          onMediaLayout={onMediaLayout}
        />
      )
    case SIDEBAR_ITEM_TYPES.folders:
      return <FolderListContentSimple folderId={item._id} />
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return <MapImagePreview imageUrl={item.imageUrl} />
    case SIDEBAR_ITEM_TYPES.canvases:
      return (
        <CanvasThumbnailPreview previewUrl={item.previewUrl} alt={item.name} objectFit="cover" />
      )
    default:
      return assertNever(item)
  }
}
