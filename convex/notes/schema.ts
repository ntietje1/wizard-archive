import { v } from 'convex/values'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { permissionLevelValidator } from '../sidebarItems/schema/validators'
import { blockShareStatusValidator, editorBlockInputValidator } from '../blocks/schema'
import { folderValidator } from '../folders/baseSchema'
import { campaignMemberIdValidator } from '../campaigns/schema'

const noteValidatorFields = {
  ...sidebarItemValidatorFields,
  type: v.literal(RESOURCE_TYPES.notes),
}

export const noteValidator = v.object(noteValidatorFields)

const blockMetaValidator = v.object({
  myPermissionLevel: permissionLevelValidator,
  shareStatus: blockShareStatusValidator,
  sharedWith: v.array(campaignMemberIdValidator),
  hiddenFrom: v.optional(v.array(campaignMemberIdValidator)),
})

const blockShareAccessWarningValidator = v.object({
  campaignMemberId: campaignMemberIdValidator,
  blockCount: v.number(),
})

export const noteWithContentValidator = v.object({
  ...noteValidatorFields,
  content: v.array(editorBlockInputValidator),
  blockMeta: v.record(v.string(), blockMetaValidator),
  blockShareAccessWarnings: v.array(blockShareAccessWarningValidator),
  ancestors: v.array(folderValidator),
})
