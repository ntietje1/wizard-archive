import { Id } from '../_generated/dataModel'
import { Note } from '../notes/types'
import { SidebarItem, SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'

export type GameMap = SidebarItem<typeof SIDEBAR_ITEM_TYPES.gameMaps> & {
  slug: string
  imageStorageId?: Id<'_storage'>
}

export type MapPin = {
  _id: Id<'mapPins'>
  _creationTime: number
  mapId: Id<'gameMaps'>
  x: number
  y: number
  iconName: string
  color?: string
} & (
  | {
      itemType: typeof SIDEBAR_ITEM_TYPES.notes
      noteId: Id<'notes'>
      pinnedMapId?: Id<'gameMaps'>
    }
  | {
      itemType: typeof SIDEBAR_ITEM_TYPES.gameMaps
      noteId?: Id<'notes'>
      pinnedMapId: Id<'gameMaps'>
    }
)

export type MapPinWithItem = MapPin &
  (
    | {
        itemType: typeof SIDEBAR_ITEM_TYPES.notes
        noteId: Id<'notes'>
        pinnedMapId?: Id<'gameMaps'>
        item: Note
      }
    | {
        itemType: typeof SIDEBAR_ITEM_TYPES.gameMaps
        noteId?: Id<'notes'>
        pinnedMapId: Id<'gameMaps'>
        item: GameMap
      }
  )

export const UNTITLED_MAP_NAME = 'Untitled Map'
