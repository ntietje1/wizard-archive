import { v } from 'convex/values'
import { commonSidebarItemValidatorFields } from '../sidebarItems/schema/baseFields'
import { commonValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'

const folderValidatorFields = {
  ...commonValidatorFields('sidebarItems'),
  ...commonSidebarItemValidatorFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.folders),
  inheritShares: v.boolean(),
}

export const folderValidator = v.object(folderValidatorFields)

export { folderValidatorFields }
