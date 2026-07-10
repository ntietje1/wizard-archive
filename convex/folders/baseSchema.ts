import { v } from 'convex/values'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'

export const folderValidatorFields = {
  ...sidebarItemValidatorFields,
  type: v.literal(RESOURCE_TYPES.folders),
  inheritShares: v.boolean(),
}

export const folderValidator = v.object(folderValidatorFields)
