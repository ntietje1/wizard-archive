import { v } from 'convex/values'
import { commonSidebarItemValidatorFields } from '../sidebarItems/schema/baseFields'
import { commonValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { permissionLevelValidator } from '../sidebarItems/schema/baseValidators'
import { blockShareStatusValidator } from '../blocks/schema'
import { customBlockValidator } from '../blocks/blockSchemas'
import { folderValidator } from '../folders/baseSchema'

const noteValidatorFields = {
  ...commonValidatorFields('sidebarItems'),
  ...commonSidebarItemValidatorFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.notes),
}

export const noteValidator = v.object(noteValidatorFields)

const blockMetaValidator = v.object({
  myPermissionLevel: permissionLevelValidator,
  shareStatus: blockShareStatusValidator,
  sharedWith: v.array(v.id('campaignMembers')),
})

export const noteWithContentValidator = v.object({
  ...noteValidatorFields,
  content: v.array(customBlockValidator),
  blockMeta: v.record(v.string(), blockMetaValidator),
  ancestors: v.array(folderValidator),
})
