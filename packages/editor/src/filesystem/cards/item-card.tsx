import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { AnyItem } from '../../workspace/items'
import { CanvasCard } from '../../canvas/preview/card'
import { FileCard } from '../../files/viewer/card'
import { FolderCard } from '../../folders/viewer/card'
import { MapCard } from '../../game-maps/viewer/card'
import { NoteCard } from '../../notes/viewer/card'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { SidebarWorkspaceItemSurfaceName } from '../../workspace/sidebar/workspace-state'
import type { ItemCardSource } from './source'

function assertNever(value: never): never {
  throw new Error(`Unsupported item type: ${String(value)}`)
}

export interface ItemCardProps<T extends AnyItem> {
  item: T
  onClick?: () => void
  isLoading?: boolean
  parentId?: SidebarItemId | null
  source: ItemCardSource
  visibleItemIds?: ReadonlyArray<SidebarItemId>
  itemSurface?: SidebarWorkspaceItemSurfaceName
}

export function ItemCard({
  item,
  onClick,
  isLoading,
  parentId,
  source,
  visibleItemIds,
  itemSurface,
}: ItemCardProps<AnyItem>) {
  switch (item.type) {
    case RESOURCE_TYPES.folders:
      return (
        <FolderCard
          item={item}
          onClick={onClick}
          isLoading={isLoading}
          parentId={parentId}
          source={source}
          visibleItemIds={visibleItemIds}
          itemSurface={itemSurface}
        />
      )
    case RESOURCE_TYPES.notes:
      return (
        <NoteCard
          item={item}
          onClick={onClick}
          isLoading={isLoading}
          parentId={parentId}
          source={source}
          visibleItemIds={visibleItemIds}
          itemSurface={itemSurface}
        />
      )
    case RESOURCE_TYPES.gameMaps:
      return (
        <MapCard
          item={item}
          onClick={onClick}
          isLoading={isLoading}
          parentId={parentId}
          source={source}
          visibleItemIds={visibleItemIds}
          itemSurface={itemSurface}
        />
      )
    case RESOURCE_TYPES.files:
      return (
        <FileCard
          item={item}
          onClick={onClick}
          isLoading={isLoading}
          parentId={parentId}
          source={source}
          visibleItemIds={visibleItemIds}
          itemSurface={itemSurface}
        />
      )
    case RESOURCE_TYPES.canvases:
      return (
        <CanvasCard
          item={item}
          onClick={onClick}
          isLoading={isLoading}
          parentId={parentId}
          source={source}
          visibleItemIds={visibleItemIds}
          itemSurface={itemSurface}
        />
      )
    default:
      return assertNever(item)
  }
}
