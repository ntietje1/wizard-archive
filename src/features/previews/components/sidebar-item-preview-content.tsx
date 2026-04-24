import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { NotePreviewContent } from '~/features/editor/components/viewer/note/note-preview-content'
import { FolderListContentSimple } from '~/features/editor/components/viewer/folder/folder-list-content-simple'
import { MapImagePreview } from '~/features/editor/components/viewer/map/map-image-preview'
import { FilePreview } from '~/features/editor/components/viewer/file/file-preview'
import { assertNever } from '~/shared/utils/utils'
import { CanvasThumbnailPreview } from './canvas-thumbnail-preview'
import type { AnySidebarItemWithContent } from 'convex/sidebarItems/types/types'

export function SidebarItemPreviewContent({ item }: { item: AnySidebarItemWithContent }) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return <NotePreviewContent content={item.content} />
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
      return <CanvasThumbnailPreview previewUrl={item.previewUrl} alt={item.name} />
    default:
      return assertNever(item)
  }
}
