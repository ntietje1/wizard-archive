import { v } from 'convex/values'
import { RESOURCE_COMMAND_TYPE } from '@wizard-archive/editor/resources/transaction-contract'
import { blockNoteIdValidator, blockShareStatusValidator } from '../blocks/schema'
import { blockVisibilityPermissionLevelValidator } from './schema'
import { campaignMemberIdValidator } from '../campaigns/schema'
import { resourceIdValidator } from '../resources/validators'

export const setBlocksShareStatusCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.setBlocksShareStatus),
  noteId: resourceIdValidator,
  blockNoteIds: v.array(blockNoteIdValidator),
  status: blockShareStatusValidator,
})

export const setBlockMemberPermissionCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.setBlockMemberPermission),
  noteId: resourceIdValidator,
  blockNoteIds: v.array(blockNoteIdValidator),
  campaignMemberId: campaignMemberIdValidator,
  permissionLevel: v.nullable(blockVisibilityPermissionLevelValidator),
})

export const blockShareCommandValidator = v.union(
  setBlocksShareStatusCommandValidator,
  setBlockMemberPermissionCommandValidator,
)
