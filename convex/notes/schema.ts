import { v } from 'convex/values'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { permissionLevelValidator } from '../sidebarItems/schema/validators'
import { blockShareStatusValidator, customBlockValidator } from '../blocks/schema'
import { folderValidator } from '../folders/baseSchema'

const noteValidatorFields = {
  ...sidebarItemValidatorFields,
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
