import { v } from 'convex/values'
import { folderValidator } from '../folders/schema'
import { anySidebarItemValidator } from '../sidebarItems/schema/schema'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'
import { sidebarItemBaseFields } from '../sidebarItems/schema/baseFields'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'

// Re-export base schema for backwards compatibility
export {
  mapTableFields,
  mapValidator,
  mapPinTableFields,
  mapPinValidator,
  mapTables,
} from './baseSchema'

const mapWithContentValidatorFields = {
  _id: v.id('gameMaps'),
  _creationTime: v.number(),
  ...sidebarItemBaseFields,
  imageStorageId: v.optional(v.id('_storage')),
  type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  imageUrl: v.union(v.string(), v.null()),
} as const

const mapPinWithItemValidatorFields = {
  _id: v.id('mapPins'),
  _creationTime: v.number(),
  mapId: v.id('gameMaps'),
  itemId: sidebarItemIdValidator,
  x: v.number(),
  y: v.number(),
  updatedAt: v.number(),
  item: anySidebarItemValidator,
}

export const mapWithContentValidator = v.object({
  ...mapWithContentValidatorFields,
  ancestors: v.array(folderValidator),
  pins: v.array(v.object(mapPinWithItemValidatorFields)),
})
