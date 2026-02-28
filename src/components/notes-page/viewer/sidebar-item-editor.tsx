import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type {
  AnySidebarItem,
  AnySidebarItemWithContent,
} from 'convex/sidebarItems/types/types'
import { assertNever } from '~/lib/utils'
import { NoteEditor } from '~/components/notes-page/viewer/note/note-editor'
import { MapViewer } from '~/components/notes-page/viewer/map/map-viewer'
import { FolderViewer } from '~/components/notes-page/viewer/folder/folder-viewer'
import { FileViewer } from '~/components/notes-page/viewer/file/file-viewer'
import { TrashBanner } from '~/components/notes-page/editor/deleted-item-banner'

export interface EditorViewerProps<T extends AnySidebarItem> {
  item: T
  search?: unknown
}

export function SidebarItemEditor({
  item,
  search,
}: EditorViewerProps<AnySidebarItemWithContent>) {
  const content = (() => {
    switch (item.type) {
      case SIDEBAR_ITEM_TYPES.notes:
        return <NoteEditor key={item._id} item={item} search={search} />
      case SIDEBAR_ITEM_TYPES.gameMaps:
        return <MapViewer key={item._id} item={item} search={search} />
      case SIDEBAR_ITEM_TYPES.folders:
        return <FolderViewer key={item._id} item={item} search={search} />
      case SIDEBAR_ITEM_TYPES.files:
        return <FileViewer key={item._id} item={item} search={search} />
      default:
        return assertNever(item)
    }
  })()

  return (
    <>
      <TrashBanner item={item} />
      {content}
    </>
  )
}
