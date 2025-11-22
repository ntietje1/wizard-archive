import { Id } from '../_generated/dataModel'
import { SidebarItem, SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import { Tag } from '../tags/types'

export type Location = Tag & {
  tagId: Id<'tags'>
  locationId: Id<'locations'>
}
export type Map = SidebarItem<typeof SIDEBAR_ITEM_TYPES.maps> & {
  imageStorageId?: Id<'_storage'>
}
export type MapPin = {
  _id: Id<'mapPins'>
  _creationTime: number
  mapId: Id<'maps'>
  locationId: Id<'locations'>
  x: number
  y: number
}

export type MapPinWithLocation = MapPin & {
  location: Location
}

export const UNTITLED_MAP_NAME = 'Untitled Map';

