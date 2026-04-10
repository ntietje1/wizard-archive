import type { Id } from '../_generated/dataModel'
import type { CommonValidatorFields } from '../common/types'
import type {
  SIDEBAR_ITEM_TYPES,
  SidebarItem,
  SidebarItemFromDb,
  SidebarItemId,
  SidebarItemType,
  SidebarItemWithContent,
} from '../sidebarItems/types/baseTypes'
import type { AnySidebarItem } from '../sidebarItems/types/types'

export type GameMapFromDb = SidebarItemFromDb<typeof SIDEBAR_ITEM_TYPES.gameMaps> & {
  imageStorageId: Id<'_storage'> | null
}

export type GameMap = SidebarItem<typeof SIDEBAR_ITEM_TYPES.gameMaps> & {
  imageStorageId: Id<'_storage'> | null
  imageUrl: string | null
}

export type GameMapWithContent = SidebarItemWithContent<typeof SIDEBAR_ITEM_TYPES.gameMaps> & {
  imageStorageId: Id<'_storage'> | null
  imageUrl: string | null
  pins: Array<MapPinWithItem>
}

export type MapPin = CommonValidatorFields<'mapPins'> & {
  mapId: Id<'sidebarItems'>
  itemId: SidebarItemId
  x: number
  y: number
  visible: boolean
}

export type MapPinWithItem = MapPin & {
  item: AnySidebarItem | null
}

export const GAME_MAP_SNAPSHOT_TYPE = 'game_map' as const

export type GameMapSnapshotPinData = {
  itemId: SidebarItemId
  x: number
  y: number
  visible: boolean
  name: string | null
  color: string | null
  iconName: string | null
  itemType: SidebarItemType | null
}

export type GameMapSnapshotData = {
  imageStorageId: string | null
  pins: Array<GameMapSnapshotPinData>
}

export const MAP_HISTORY_ACTION = {
  map_image_changed: 'map_image_changed',
  map_image_removed: 'map_image_removed',
  map_pin_added: 'map_pin_added',
  map_pin_moved: 'map_pin_moved',
  map_pin_removed: 'map_pin_removed',
  map_pin_visibility_changed: 'map_pin_visibility_changed',
} as const

export type MapHistoryAction = (typeof MAP_HISTORY_ACTION)[keyof typeof MAP_HISTORY_ACTION]

export type MapHistoryMetadataMap = {
  [MAP_HISTORY_ACTION.map_image_changed]: null
  [MAP_HISTORY_ACTION.map_image_removed]: null
  [MAP_HISTORY_ACTION.map_pin_added]: { pinItemName: string }
  [MAP_HISTORY_ACTION.map_pin_moved]: { pinItemName: string }
  [MAP_HISTORY_ACTION.map_pin_removed]: { pinItemName: string }
  [MAP_HISTORY_ACTION.map_pin_visibility_changed]: {
    pinItemName: string
    visible: boolean
  }
}
