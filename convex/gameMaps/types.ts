import type { Id } from '../_generated/dataModel'
import type { CommonValidatorFields } from '../common/types'
import type {
  SIDEBAR_ITEM_TYPES,
  SidebarItem,
  SidebarItemFromDb,
  SidebarItemId,
  SidebarItemWithContent,
} from '../sidebarItems/types/baseTypes'
import type { AnySidebarItem } from '../sidebarItems/types/types'

export type GameMapFromDb = SidebarItemFromDb<
  typeof SIDEBAR_ITEM_TYPES.gameMaps
> & {
  imageStorageId: Id<'_storage'> | null
}

export type GameMap = SidebarItem<typeof SIDEBAR_ITEM_TYPES.gameMaps> & {
  imageStorageId: Id<'_storage'> | null
  imageUrl: string | null
}

export type GameMapWithContent = SidebarItemWithContent<
  typeof SIDEBAR_ITEM_TYPES.gameMaps
> & {
  imageStorageId: Id<'_storage'> | null
  imageUrl: string | null
  pins: Array<MapPinWithItem>
}

export type MapPin = CommonValidatorFields<'mapPins'> & {
  mapId: Id<'gameMaps'>
  itemId: SidebarItemId
  x: number
  y: number
  visible: boolean
}

export type MapPinWithItem = MapPin & {
  item?: AnySidebarItem
}
