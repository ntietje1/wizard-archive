import { v } from 'convex/values'
import { folderValidator } from '../folders/baseSchema'
import { anySidebarItemValidator } from '../sidebarItems/schema/schema'
import { commonSidebarItemValidatorFields } from '../sidebarItems/schema/baseFields'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'
import { commonValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'

const mapWithContentValidatorFields = {
  ...commonValidatorFields('gameMaps'),
  ...commonSidebarItemValidatorFields,
  imageStorageId: v.optional(v.id('_storage')),
  type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  imageUrl: v.union(v.string(), v.null()),
}

const mapPinWithItemValidatorFields = {
  ...commonValidatorFields('mapPins'),
  mapId: v.id('gameMaps'),
  itemId: sidebarItemIdValidator,
  x: v.number(),
  y: v.number(),
  visible: v.optional(v.boolean()),
  item: v.optional(anySidebarItemValidator),
}

export const mapWithContentValidator = v.object({
  ...mapWithContentValidatorFields,
  ancestors: v.array(folderValidator),
  pins: v.array(v.object(mapPinWithItemValidatorFields)),
})
