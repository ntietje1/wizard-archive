import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { FolderListContentSimple } from '~/features/editor/components/viewer/folder/folder-list-content-simple'
import { MapImagePreview } from '~/features/editor/components/viewer/map/map-image-preview'
import { FilePreview } from '~/features/editor/components/viewer/file/file-preview'
import { assertNever } from '~/shared/utils/utils'
import { CanvasThumbnailPreview } from './canvas-thumbnail-preview'
import { RawNoteContent } from '~/features/editor/components/raw-note-content'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import type { NoteWithContent } from 'shared/notes/types'

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
        <StaticNotePreviewContent
          note={item}
          allowInnerScroll={allowInnerScroll}
          constrained={constrainNotePreview && !fillAvailableHeight}
          fillAvailableHeight={fillAvailableHeight}
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

function StaticNotePreviewContent({
  allowInnerScroll,
  constrained,
  fillAvailableHeight,
  note,
}: {
  allowInnerScroll: boolean
  constrained: boolean
  fillAvailableHeight: boolean
  note: NoteWithContent
}) {
  const maxPreviewHeight = constrained ? 'min(480px, 70vh)' : undefined

  return (
    <div
      className={cn('h-full', constrained && 'overflow-hidden')}
      style={maxPreviewHeight ? { maxHeight: maxPreviewHeight } : undefined}
    >
      <ScrollArea
        className="h-full"
        contentClassName="note-editor-scroll-content"
        scrollOrientation={allowInnerScroll ? 'vertical' : 'none'}
        viewportStyle={{
          ...(maxPreviewHeight ? { maxHeight: maxPreviewHeight } : {}),
          ...(!allowInnerScroll ? { overflowY: 'hidden' as const } : {}),
        }}
      >
        <RawNoteContent
          content={note.content}
          editable={false}
          fillHeight={fillAvailableHeight}
          noteId={note._id}
        />
      </ScrollArea>
    </div>
  )
}
