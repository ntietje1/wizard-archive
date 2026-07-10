import { v } from 'convex/values'
import { folderValidator } from '../folders/baseSchema'
import { anySidebarItemValidator } from '../sidebarItems/schema/anySidebarItemValidator'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { mapPinValidatorFields } from './baseSchema'

const mapWithContentValidatorFields = {
  ...sidebarItemValidatorFields,
  imageAssetId: v.nullable(v.id('_storage')),
  type: v.literal(RESOURCE_TYPES.gameMaps),
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
