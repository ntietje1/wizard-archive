import { v } from 'convex/values'
import { commonSidebarItemValidatorFields } from '../sidebarItems/schema/baseFields'
import { commonValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'

export const canvasValidatorFields = {
  ...commonValidatorFields('sidebarItems'),
  ...commonSidebarItemValidatorFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.canvases),
}

export const canvasValidator = v.object(canvasValidatorFields)
