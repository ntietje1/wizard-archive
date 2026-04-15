import { v } from 'convex/values'
import { folderValidator } from '../folders/baseSchema'
import { anySidebarItemValidator } from '../sidebarItems/schema/anySidebarItemValidator'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { mapPinValidatorFields } from './baseSchema'

const mapWithContentValidatorFields = {
  ...sidebarItemValidatorFields,
  imageStorageId: v.nullable(v.id('_storage')),
  type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  imageUrl: v.nullable(v.string()),
}

const mapPinWithItemValidatorFields = {
  ...mapPinValidatorFields,
  item: v.nullable(anySidebarItemValidator),
}

export const mapWithContentValidator = v.object({
  ...mapWithContentValidatorFields,
  ancestors: v.array(folderValidator),
  pins: v.array(v.object(mapPinWithItemValidatorFields)),
})
