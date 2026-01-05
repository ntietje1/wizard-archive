import { v } from 'convex/values'
import { sidebarItemIdValidator } from '../sidebarItems/baseFields'
import { anySidebarItemValidator } from '../sidebarItems/schema'

export const mapPinWithItemValidator = v.object({
  _id: v.id('mapPins'),
  _creationTime: v.number(),
  mapId: v.id('gameMaps'),
  itemId: sidebarItemIdValidator,
  x: v.number(),
  y: v.number(),
  updatedAt: v.number(),
  item: anySidebarItemValidator,
})
