import { v } from 'convex/values'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { SIDEBAR_ITEM_TYPES } from '../../shared/sidebar-items/types'
import { permissionLevelValidator } from '../sidebarItems/schema/validators'
import { blockShareStatusValidator, editorBlockInputValidator } from '../blocks/schema'
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
  hiddenFrom: v.optional(v.array(v.id('campaignMembers'))),
})

const blockShareAccessWarningValidator = v.object({
  campaignMemberId: v.id('campaignMembers'),
  blockCount: v.number(),
})

export const noteWithContentValidator = v.object({
  ...noteValidatorFields,
  content: v.array(editorBlockInputValidator),
  blockMeta: v.record(v.string(), blockMetaValidator),
  blockShareAccessWarnings: v.array(blockShareAccessWarningValidator),
  ancestors: v.array(folderValidator),
})
