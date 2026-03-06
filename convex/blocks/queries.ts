import { v } from 'convex/values'
import { authQuery } from '../functions'
import { blockShareValidator } from '../blockShares/schema'
import { campaignMemberValidator } from '../campaigns/schema'
import {
  blockNoteIdValidator,
  blockShareStatusValidator,
  blockValidator,
} from './schema'
import { getBlockWithShares as getBlockWithSharesFn } from './functions/getBlockWithShares'
import { getBlocksWithShares as getBlocksWithSharesFn } from './functions/getBlocksWithShares'

export const getBlockWithShares = authQuery({
  args: {
    noteId: v.id('notes'),
    blockId: blockNoteIdValidator,
  },
  returns: v.union(
    v.object({
      block: blockValidator,
      shareStatus: blockShareStatusValidator,
      shares: v.array(blockShareValidator),
      playerMembers: v.array(campaignMemberValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await getBlockWithSharesFn(ctx, {
      noteId: args.noteId,
      blockId: args.blockId,
    })
  },
})

const blockShareInfoValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  shareStatus: blockShareStatusValidator,
  sharedMemberIds: v.array(v.id('campaignMembers')),
  isTopLevel: v.boolean(),
})

export const getBlocksWithShares = authQuery({
  args: {
    noteId: v.id('notes'),
    blockIds: v.array(blockNoteIdValidator),
  },
  returns: v.object({
    blocks: v.array(blockShareInfoValidator),
    playerMembers: v.array(campaignMemberValidator),
  }),
  handler: async (ctx, args) => {
    return await getBlocksWithSharesFn(ctx, {
      noteId: args.noteId,
      blockIds: args.blockIds,
    })
  },
})
