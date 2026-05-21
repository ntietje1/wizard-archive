import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { blockNoteIdValidator, blockShareStatusValidator } from '../blocks/schema'
import { setBlocksShareStatus as setBlocksShareStatusFn } from './functions/setBlocksShareStatus'
import { shareBlocks as shareBlocksFn } from './functions/shareBlocks'
import { unshareBlocks as unshareBlocksFn } from './functions/unshareBlocks'
import { ERROR_CODE, throwClientError } from '../errors'
import { projectNoteBlocksFromYjsInMutation } from '../notes/functions/projectNoteBlocksFromYjs'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

async function getCampaignOrThrow(ctx: MutationCtx, campaignId: Id<'campaigns'>) {
  const campaign = await ctx.db.get('campaigns', campaignId)
  if (!campaign) throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign not found')
  return campaign
}

async function getBlockShareCtx(
  ctx: MutationCtx,
  args: { campaignId: Id<'campaigns'>; actorCampaignMemberId: Id<'campaignMembers'> },
) {
  return {
    ...ctx,
    campaign: await getCampaignOrThrow(ctx, args.campaignId),
    membership: { _id: args.actorCampaignMemberId },
  }
}

export const setBlocksShareStatus = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    actorCampaignMemberId: v.id('campaignMembers'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    status: blockShareStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await projectNoteBlocksFromYjsInMutation(ctx, args.noteId)
    await setBlocksShareStatusFn(await getBlockShareCtx(ctx, args), args)
    return null
  },
})

export const shareBlocks = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    actorCampaignMemberId: v.id('campaignMembers'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await projectNoteBlocksFromYjsInMutation(ctx, args.noteId)
    await shareBlocksFn(await getBlockShareCtx(ctx, args), args)
    return null
  },
})

export const unshareBlocks = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    actorCampaignMemberId: v.id('campaignMembers'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await projectNoteBlocksFromYjsInMutation(ctx, args.noteId)
    await unshareBlocksFn(await getBlockShareCtx(ctx, args), args)
    return null
  },
})
