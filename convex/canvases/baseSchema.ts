import { v } from 'convex/values'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'

export const canvasValidatorFields = {
  ...sidebarItemValidatorFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.canvases),
}

export const canvasValidator = v.object(canvasValidatorFields)
