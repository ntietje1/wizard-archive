import { v } from 'convex/values'
import { campaignQuery, dmQuery } from '../functions'
import { blockVisibilityPermissionLevelValidator } from '../blockShares/schema'
import { campaignMemberSummaryValidator } from '../campaigns/schema'
import { permissionLevelValidator } from '../sidebarItems/schema/validators'
import { blockNoteIdValidator, blockShareStatusValidator, blockTypeValidator } from './schema'
import { getBlocksWithShares as getBlocksWithSharesFn } from './functions/getBlocksWithShares'
import { getHeadingsByNote as getHeadingsByNoteFn } from './functions/getHeadingsByNote'
import { searchBlocks as searchBlocksFn } from './functions/searchBlocks'

const blockShareInfoValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  shareStatus: blockShareStatusValidator,
  memberPermissions: v.record(v.id('campaignMembers'), blockVisibilityPermissionLevelValidator),
})

export const getBlocksWithShares = dmQuery({
  args: {
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
  },
  returns: v.object({
    blocks: v.array(blockShareInfoValidator),
    playerMembers: v.array(campaignMemberSummaryValidator),
    notePermissionsByMemberId: v.record(v.id('campaignMembers'), permissionLevelValidator),
  }),
  handler: async (ctx, args) => {
    return await getBlocksWithSharesFn(ctx, {
      noteId: args.noteId,
      blockNoteIds: args.blockNoteIds,
    })
  },
})

const headingResultValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  text: v.string(),
  level: v.number(),
  normalizedText: v.string(),
})

export const getHeadingsByNote = campaignQuery({
  args: {
    noteId: v.id('sidebarItems'),
  },
  returns: v.array(headingResultValidator),
  handler: async (ctx, args) => {
    return await getHeadingsByNoteFn(ctx, { noteId: args.noteId })
  },
})

const blockSearchResultValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  noteId: v.id('sidebarItems'),
  plainText: v.string(),
  type: blockTypeValidator,
})

export const searchBlocks = campaignQuery({
  args: {
    query: v.string(),
  },
  returns: v.array(blockSearchResultValidator),
  handler: async (ctx, args) => {
    return await searchBlocksFn(ctx, { query: args.query })
  },
})
