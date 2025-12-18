import {
  SIDEBAR_ITEM_TYPES,
  type AnySidebarItem,
} from 'convex/sidebarItems/types'
import { NoteCard } from './note-card'
import { FolderCard } from './folder-card'
import { MapCard } from './map-card'
import { TagCard } from './tag-card'
import type { TagCategory } from 'convex/tags/types'

export interface ItemCardProps<T extends AnySidebarItem> {
  item: T
  category?: TagCategory
  onClick?: () => void
  isLoading?: boolean
}

export function ItemCard({ item }: ItemCardProps<AnySidebarItem>) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.folders:
      return <FolderCard item={item} />
    case SIDEBAR_ITEM_TYPES.notes:
      return <NoteCard item={item} />
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return <MapCard item={item} />
    case SIDEBAR_ITEM_TYPES.tags:
      return <TagCard item={item} />
    default:
      console.error(`Unsupported item type: ${item.type}`)
      return null
  }
}
