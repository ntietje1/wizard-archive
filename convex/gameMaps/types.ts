import type { Id } from '../_generated/dataModel'
import type {
  SIDEBAR_ITEM_TYPES,
  SidebarItem,
  SidebarItemFromDb,
  SidebarItemId,
  SidebarItemWithContent,
} from '../sidebarItems/baseTypes'
import type { AnySidebarItem } from '../sidebarItems/types'

export type GameMapFromDb = SidebarItemFromDb<
  typeof SIDEBAR_ITEM_TYPES.gameMaps
> & {
  imageStorageId?: Id<'_storage'>
}

export type GameMap = SidebarItem<typeof SIDEBAR_ITEM_TYPES.gameMaps> & {
  imageStorageId?: Id<'_storage'>
  imageUrl: string | null
}

export type GameMapWithContent = SidebarItemWithContent<
  typeof SIDEBAR_ITEM_TYPES.gameMaps
> & {
  imageStorageId?: Id<'_storage'>
  imageUrl: string | null
  pins: Array<MapPinWithItem>
}

export type MapPin = {
  _id: Id<'mapPins'>
  _creationTime: number
  mapId: Id<'gameMaps'>
  itemId: SidebarItemId
  x: number
  y: number
  updatedAt: number
}

export type MapPinWithItem = MapPin & {
  item: AnySidebarItem
}
