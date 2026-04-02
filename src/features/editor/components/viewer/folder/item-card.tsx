import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { NoteCard } from './note-card'
import { FolderCard } from './folder-card'
import { MapCard } from './map-card'
import { FileCard } from './file-card'
import { CanvasCard } from './canvas-card'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { assertNever } from '~/shared/utils/utils'

export interface ItemCardProps<T extends AnySidebarItem> {
  item: T
  onClick?: () => void
  isLoading?: boolean
  parentId?: Id<'folders'> | null
}

export function ItemCard({ item, parentId }: ItemCardProps<AnySidebarItem>) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.folders:
      return <FolderCard item={item} parentId={parentId} />
    case SIDEBAR_ITEM_TYPES.notes:
      return <NoteCard item={item} />
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return <MapCard item={item} />
    case SIDEBAR_ITEM_TYPES.files:
      return <FileCard item={item} />
    case SIDEBAR_ITEM_TYPES.canvases:
      return <CanvasCard item={item} />
    default:
      return assertNever(item)
  }
}
