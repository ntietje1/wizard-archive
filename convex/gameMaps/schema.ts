import { v } from 'convex/values'
import { folderValidator } from '../folders/baseSchema'
import { anySidebarItemValidator } from '../sidebarItems/schema/schema'
import { commonSidebarItemValidatorFields } from '../sidebarItems/schema/baseFields'
import { commonValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { mapPinTableFields } from './baseSchema'

const mapWithContentValidatorFields = {
  ...commonValidatorFields('sidebarItems'),
  ...commonSidebarItemValidatorFields,
  imageStorageId: v.nullable(v.id('_storage')),
  type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  imageUrl: v.nullable(v.string()),
}

const mapPinWithItemValidatorFields = {
  ...commonValidatorFields('mapPins'),
  ...mapPinTableFields,
  item: v.nullable(anySidebarItemValidator),
}

export const mapWithContentValidator = v.object({
  ...mapWithContentValidatorFields,
  ancestors: v.array(folderValidator),
  pins: v.array(v.object(mapPinWithItemValidatorFields)),
})
