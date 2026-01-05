import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { NoteEditor } from '~/components/notes-page/viewer/note/note-editor'
import { TagEditor } from '~/components/notes-page/viewer/tag/tag-editor'
import { MapViewer } from '~/components/notes-page/viewer/map/map-viewer'
import { FolderViewer } from '~/components/notes-page/viewer/folder/folder-viewer'
import { CategoryViewer } from '~/components/notes-page/viewer/category/category-viewer'
import { FileViewer } from '~/components/notes-page/viewer/file/file-viewer'

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
      return <NoteEditor item={item} search={search} />
    case SIDEBAR_ITEM_TYPES.tags:
      return <TagEditor item={item} search={search} />
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return <MapViewer item={item} search={search} />
    case SIDEBAR_ITEM_TYPES.folders:
      return <FolderViewer item={item} search={search} />
    case SIDEBAR_ITEM_TYPES.tagCategories:
      return <CategoryViewer item={item} search={search} />
    case SIDEBAR_ITEM_TYPES.files:
      return <FileViewer item={item} search={search} />
    default: {
      // @ts-ignore - exhaustive check for unknown item types
      console.error(`No viewer available for item type: ${item.type}`)
      return null
    }
  }
}
