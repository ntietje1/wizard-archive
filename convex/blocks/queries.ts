import { v } from 'convex/values'
import { query } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import {
  getCampaignMembers,
  requireCampaignMembership,
} from '../campaigns/campaigns'
import { getBlockSharesForBlock } from '../shares/blockShares'
import { blockShareValidator } from '../shares/schema'
import { campaignMemberValidator } from '../campaigns/schema'
import { SHARE_STATUS } from '../shares/types'
import {
  blockNoteIdValidator,
  blockShareStatusValidator,
  blockValidator,
} from './schema'
import { findBlockByBlockNoteId } from './blocks'
import type { Id } from '../_generated/dataModel'
import type { Block } from './types'
import type { BlockShare, ShareStatus  } from '../shares/types'
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
    shareStatus: ShareStatus
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

    const shareStatus: ShareStatus =
      block.shareStatus ?? SHARE_STATUS.NOT_SHARED

    const allMembers = await getCampaignMembers(ctx, note.campaignId)
    const playerMembers = allMembers.filter(
      (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
    )

    let shares: Array<BlockShare> = []
    if (shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED) {
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

const blockShareInfoValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  shareStatus: blockShareStatusValidator,
  sharedMemberIds: v.array(v.id('campaignMembers')),
  isTopLevel: v.boolean(),
})

export type BlockShareInfo = {
  blockNoteId: string
  shareStatus: ShareStatus
  sharedMemberIds: Array<Id<'campaignMembers'>>
  isTopLevel: boolean
}

export const getBlocksWithShares = query({
  args: {
    noteId: v.id('notes'),
    blockIds: v.array(blockNoteIdValidator),
  },
  returns: v.object({
    blocks: v.array(blockShareInfoValidator),
    playerMembers: v.array(campaignMemberValidator),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    blocks: Array<BlockShareInfo>
    playerMembers: Array<CampaignMember>
  }> => {
    const note = await ctx.db.get(args.noteId)
    if (!note) throw new Error('Note not found')

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const allMembers = await getCampaignMembers(ctx, note.campaignId)
    const playerMembers = allMembers.filter(
      (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
    )

    const blocks: Array<BlockShareInfo> = []

    for (const blockId of args.blockIds) {
      const block = await findBlockByBlockNoteId(ctx, args.noteId, blockId)

      if (!block) {
        // Block doesn't exist in DB yet - treat as not shared, top-level
        blocks.push({
          blockNoteId: blockId,
          shareStatus: SHARE_STATUS.NOT_SHARED,
          sharedMemberIds: [],
          isTopLevel: true,
        })
        continue
      }

      const shareStatus: ShareStatus =
        block.shareStatus ?? SHARE_STATUS.NOT_SHARED

      let sharedMemberIds: Array<Id<'campaignMembers'>> = []
      if (shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED) {
        const shares = await getBlockSharesForBlock(
          ctx,
          note.campaignId,
          block._id,
        )
        sharedMemberIds = shares.map((s) => s.campaignMemberId)
      }

      blocks.push({
        blockNoteId: blockId,
        shareStatus,
        sharedMemberIds,
        isTopLevel: block.isTopLevel,
      })
    }

    return {
      blocks,
      playerMembers,
    }
  },
})
