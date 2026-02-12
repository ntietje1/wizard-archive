import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import type {
  AnySidebarItem,
  AnySidebarItemWithContent,
} from 'convex/sidebarItems/types'
import { NoteEditor } from '~/components/notes-page/viewer/note/note-editor'
import { MapViewer } from '~/components/notes-page/viewer/map/map-viewer'
import { FolderViewer } from '~/components/notes-page/viewer/folder/folder-viewer'
import { FileViewer } from '~/components/notes-page/viewer/file/file-viewer'

export interface EditorViewerProps<T extends AnySidebarItem> {
  item: T
  search?: unknown
}

export function SidebarItemEditor({
  item,
  search,
}: EditorViewerProps<AnySidebarItemWithContent>) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return <NoteEditor item={item} search={search} />
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return <MapViewer item={item} search={search} />
    case SIDEBAR_ITEM_TYPES.folders:
      return <FolderViewer item={item} search={search} />
    case SIDEBAR_ITEM_TYPES.files:
      return <FileViewer item={item} search={search} />
    default: {
      console.warn(`Unknown item type`, item)
      return null
    }
  }
}
