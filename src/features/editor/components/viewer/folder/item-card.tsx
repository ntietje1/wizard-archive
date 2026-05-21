import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { NoteCard } from './note-card'
import { FolderCard } from './folder-card'
import { MapCard } from './map-card'
import { FileCard } from './file-card'
import { CanvasCard } from './canvas-card'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { ItemSurface } from '~/features/sidebar/stores/sidebar-ui-store'
import { assertNever } from '~/shared/utils/utils'

export interface ItemCardProps<T extends AnySidebarItem> {
  item: T
  onClick?: () => void
  isLoading?: boolean
  parentId?: Id<'sidebarItems'> | null
  visibleItemIds?: Array<Id<'sidebarItems'>>
  itemSurface?: ItemSurface
}

export function ItemCard({
  item,
  onClick,
  isLoading,
  parentId,
  visibleItemIds,
  itemSurface,
}: ItemCardProps<AnySidebarItem>) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.folders:
      return (
        <FolderCard
          item={item}
          onClick={onClick}
          isLoading={isLoading}
          parentId={parentId}
          visibleItemIds={visibleItemIds}
          itemSurface={itemSurface}
        />
      )
    case SIDEBAR_ITEM_TYPES.notes:
      return (
        <NoteCard
          item={item}
          onClick={onClick}
          isLoading={isLoading}
          parentId={parentId}
          visibleItemIds={visibleItemIds}
          itemSurface={itemSurface}
        />
      )
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return (
        <MapCard
          item={item}
          onClick={onClick}
          isLoading={isLoading}
          parentId={parentId}
          visibleItemIds={visibleItemIds}
          itemSurface={itemSurface}
        />
      )
    case SIDEBAR_ITEM_TYPES.files:
      return (
        <FileCard
          item={item}
          onClick={onClick}
          isLoading={isLoading}
          parentId={parentId}
          visibleItemIds={visibleItemIds}
          itemSurface={itemSurface}
        />
      )
    case SIDEBAR_ITEM_TYPES.canvases:
      return (
        <CanvasCard
          item={item}
          onClick={onClick}
          isLoading={isLoading}
          parentId={parentId}
          visibleItemIds={visibleItemIds}
          itemSurface={itemSurface}
        />
      )
    default:
      return assertNever(item)
  }
}
