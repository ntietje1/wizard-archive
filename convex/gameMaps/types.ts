import { Id } from '../_generated/dataModel'
import {
  SidebarItem,
  SIDEBAR_ITEM_TYPES,
  SidebarItemId,
  AnySidebarItem,
} from '../sidebarItems/types'

export type GameMap = SidebarItem<typeof SIDEBAR_ITEM_TYPES.gameMaps> & {
  imageStorageId?: Id<'_storage'>
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
