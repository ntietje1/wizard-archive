import { v } from 'convex/values'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'

export const canvasValidatorFields = {
  ...sidebarItemValidatorFields,
  type: v.literal(RESOURCE_TYPES.canvases),
}

export const canvasValidator = v.object(canvasValidatorFields)
