import { Id } from "../_generated/dataModel";
import { Note } from "../notes/types";
import { SidebarItem, SIDEBAR_ITEM_TYPES } from "../sidebarItems/types";


export type Map = SidebarItem<typeof SIDEBAR_ITEM_TYPES.maps> & {
  imageStorageId?: Id<'_storage'>
}

export type MapPin = {
  _id: Id<'mapPins'>
  _creationTime: number
  mapId: Id<'maps'>
  x: number
  y: number
  iconName: string
  color?: string
} & (
  | {
      itemType: typeof SIDEBAR_ITEM_TYPES.notes
      noteId: Id<'notes'>
      pinnedMapId?: Id<'maps'>
    }
  | {
      itemType: typeof SIDEBAR_ITEM_TYPES.maps
      noteId?: Id<'notes'>
      pinnedMapId: Id<'maps'>
    }
)

export type MapPinWithItem = MapPin & (
  | {
      itemType: typeof SIDEBAR_ITEM_TYPES.notes
      noteId: Id<'notes'>
      pinnedMapId?: Id<'maps'>
      item: Note
    }
  | {
      itemType: typeof SIDEBAR_ITEM_TYPES.maps
      noteId?: Id<'notes'>
      pinnedMapId: Id<'maps'>
      item: Map
    }
)

export const UNTITLED_MAP_NAME = 'Untitled Map'
