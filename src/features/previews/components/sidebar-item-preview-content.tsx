import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { FolderListContentSimple } from '~/features/editor/components/viewer/folder/folder-list-content-simple'
import { MapImagePreview } from '~/features/editor/components/viewer/map/map-image-preview'
import { FilePreview } from '~/features/editor/components/viewer/file/file-preview'
import { assertNever } from '~/shared/utils/utils'
import { CanvasThumbnailPreview } from './canvas-thumbnail-preview'
import { EmbeddedNoteContent } from '~/features/embeds/components/embedded-note-content'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'

export function SidebarItemPreviewContent({
  item,
  allowInnerScroll = true,
  constrainNotePreview = false,
  fillAvailableHeight = false,
}: {
  item: AnySidebarItemWithContent
  allowInnerScroll?: boolean
  constrainNotePreview?: boolean
  fillAvailableHeight?: boolean
}) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return (
        <EmbeddedNoteContent
          note={item}
          editable={false}
          allowInnerScroll={allowInnerScroll}
          constrained={constrainNotePreview && !fillAvailableHeight}
        />
      )
    case SIDEBAR_ITEM_TYPES.folders:
      return <FolderListContentSimple folderId={item._id} />
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return <MapImagePreview imageUrl={item.imageUrl} />
    case SIDEBAR_ITEM_TYPES.files:
      return (
        <FilePreview
          downloadUrl={item.downloadUrl}
          contentType={item.contentType}
          previewUrl={item.previewUrl}
          alt={item.name}
        />
      )
    case SIDEBAR_ITEM_TYPES.canvases:
      return (
        <CanvasThumbnailPreview
          previewUrl={item.previewUrl}
          alt={item.name}
          objectFit={fillAvailableHeight ? 'cover' : 'contain'}
        />
      )
    default:
      return assertNever(item)
  }
}
