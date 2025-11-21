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

export const UNTITLED_MAP_NAME = 'Untitled Map';

