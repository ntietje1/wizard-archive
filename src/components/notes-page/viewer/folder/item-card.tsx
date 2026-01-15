import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { NoteCard } from './note-card'
import { FolderCard } from './folder-card'
import { MapCard } from './map-card'
import { FileCard } from './file-card'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'

export interface ItemCardProps<T extends AnySidebarItem> {
  item: T
  onClick?: () => void
  isLoading?: boolean
  parentId?: SidebarItemId
}

export function ItemCard({
  item,
  parentId,
}: ItemCardProps<AnySidebarItem>) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.folders:
      return <FolderCard item={item} parentId={parentId} />
    case SIDEBAR_ITEM_TYPES.notes:
      return <NoteCard item={item} />
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return <MapCard item={item} />
    case SIDEBAR_ITEM_TYPES.files:
      return <FileCard item={item} />
    default:
      console.error(`Unsupported item type: ${(item as { type: string }).type}`)
      return null
  }
}
