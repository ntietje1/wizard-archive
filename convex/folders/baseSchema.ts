import { v } from 'convex/values'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { SIDEBAR_ITEM_TYPES } from '../../shared/sidebar-items/types'

const folderValidatorFields = {
  ...sidebarItemValidatorFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.folders),
  inheritShares: v.boolean(),
}

export const folderValidator = v.object(folderValidatorFields)

export { folderValidatorFields }
