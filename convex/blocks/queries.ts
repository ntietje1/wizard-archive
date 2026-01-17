import { v } from 'convex/values'
import { query } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import {
  getCampaignMembers,
  requireCampaignMembership,
} from '../campaigns/campaigns'
import { getBlockSharesForBlock } from '../shares/shares'
import { blockShareValidator } from '../shares/schema'
import { campaignMemberValidator } from '../campaigns/schema'
import {
  blockNoteIdValidator,
  blockShareStatusValidator,
  blockValidator,
} from './schema'
import { findBlockByBlockNoteId } from './blocks'
import { BLOCK_SHARE_STATUS } from './types'
import type { Block, BlockShareStatus } from './types'
import type { BlockShare } from '../shares/types'
import type { CampaignMember } from '../campaigns/types'

export const getBlockById = query({
  args: {
    blockId: v.id('blocks'),
  },
  returns: v.union(blockValidator, v.null()),
  handler: async (ctx, args): Promise<Block | null> => {
    const block = await ctx.db.get(args.blockId)
    if (!block) return null

    await requireCampaignMembership(
      ctx,
      { campaignId: block.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    return block
  },
})

export const getBlockWithShares = query({
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    block: Block
    shareStatus: BlockShareStatus
    shares: Array<BlockShare>
    playerMembers: Array<CampaignMember>
  } | null> => {
    const note = await ctx.db.get(args.noteId)
    if (!note) throw new Error('Note not found')

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const block = await findBlockByBlockNoteId(ctx, args.noteId, args.blockId)
    if (!block) {
      return null
    }

    const shareStatus: BlockShareStatus =
      block.shareStatus ?? BLOCK_SHARE_STATUS.NOT_SHARED

    const allMembers = await getCampaignMembers(ctx, note.campaignId)
    const playerMembers = allMembers.filter(
      (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
    )

    let shares: Array<BlockShare> = []
    if (shareStatus === BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED) {
      shares = await getBlockSharesForBlock(ctx, note.campaignId, block._id)
    }

    return {
      block,
      shareStatus,
      shares,
      playerMembers,
    }
  },
})
