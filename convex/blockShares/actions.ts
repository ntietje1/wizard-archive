import { v } from 'convex/values'
import { action } from '../_generated/server'
import type { ActionCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { internal } from '../_generated/api'
import { blockNoteIdValidator, blockShareStatusValidator } from '../blocks/schema'

async function requireWriteAccess(
  ctx: ActionCtx,
  args: { campaignId: Id<'campaigns'>; noteId: Id<'sidebarItems'> },
) {
  return await ctx.runQuery(internal.notes.internalQueries.requireNoteDmWriteAccess, {
    campaignId: args.campaignId,
    documentId: args.noteId,
  })
}

export const setBlocksShareStatus = action({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    status: blockShareStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorCampaignMemberId = await requireWriteAccess(ctx, args)
    await ctx.runMutation(internal.blockShares.internalMutations.setBlocksShareStatus, {
      ...args,
      actorCampaignMemberId,
    })
    return null
  },
})

export const shareBlocks = action({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorCampaignMemberId = await requireWriteAccess(ctx, args)
    await ctx.runMutation(internal.blockShares.internalMutations.shareBlocks, {
      ...args,
      actorCampaignMemberId,
    })
    return null
  },
})

export const unshareBlocks = action({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorCampaignMemberId = await requireWriteAccess(ctx, args)
    await ctx.runMutation(internal.blockShares.internalMutations.unshareBlocks, {
      ...args,
      actorCampaignMemberId,
    })
    return null
  },
})
