import { v } from 'convex/values'
import { sidebarItemIdValidator } from '../sidebarItems/idValidator'
import { anySidebarItemValidator } from '../sidebarItems/schema'

export const mapPinWithItemValidator = v.object({
  _id: v.id('mapPins'),
  _creationTime: v.number(),
  mapId: v.id('gameMaps'),
  itemId: sidebarItemIdValidator,
  iconName: v.string(),
  color: v.optional(v.string()),
  x: v.number(),
  y: v.number(),
  updatedAt: v.number(),
  item: anySidebarItemValidator,
})
