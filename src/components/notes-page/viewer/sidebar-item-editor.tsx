import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { NoteViewer } from './note/note-viewer'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { NoteEditor } from '~/components/notes-page/viewer/note/note-editor'
import { MapViewer } from '~/components/notes-page/viewer/map/map-viewer'
import { FolderViewer } from '~/components/notes-page/viewer/folder/folder-viewer'
import { FileViewer } from '~/components/notes-page/viewer/file/file-viewer'
import { Separator } from '~/components/shadcn/ui/separator'

export interface EditorViewerProps<T extends AnySidebarItem> {
  item: T
  search?: unknown
}

export function SidebarItemEditor({
  item,
  search,
}: EditorViewerProps<AnySidebarItem>) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return (
        <div className="flex flex-row h-full">
          <NoteEditor key={`${item._id}-editor`} item={item} search={search} />
          <Separator orientation="vertical" className="h-full" />
          <NoteViewer key={`${item._id}-viewer`} item={item} search={search} />
        </div>
      )
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return <MapViewer key={item._id} item={item} search={search} />
    case SIDEBAR_ITEM_TYPES.folders:
      return <FolderViewer key={item._id} item={item} search={search} />
    case SIDEBAR_ITEM_TYPES.files:
      return <FileViewer key={item._id} item={item} search={search} />
    default: {
      console.warn(`Unknown item type`, item)
      return null
    }
  }
}
