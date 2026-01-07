import { v } from 'convex/values'
import { query } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import {
  getCampaignMembers,
  requireCampaignMembership,
} from '../campaigns/campaigns'
import {
  extractMentionsFromBlockContent,
  getBlockMentions,
} from '../mentions/mentions'
import { getBlockSharesForBlock } from '../shares/shares'
import { blockShareValidator } from '../shares/schema'
import { campaignMemberValidator } from '../campaigns/schema'
import { sidebarItemIdValidator } from '../sidebarItems/baseFields'
import {
  blockMentionValidator,
  blockShareStatusValidator,
  blockValidator,
} from './schema'
import { findBlockByBlockNoteId, getBlocksByCampaign } from './blocks'
import { BLOCK_SHARE_STATUS } from './types'
import type { SidebarItemId } from '../sidebarItems/types'
import type { Block, BlockMention, BlockShareStatus } from './types'
import type { BlockShare } from '../shares/types'
import type { CampaignMember } from '../campaigns/types'

// TODO: make this more efficient by using an index instead of querying all blocks
export const getBlocksByMentionedItem = query({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
  },
  returns: v.array(blockValidator),
  handler: async (ctx, args): Promise<Array<Block>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    // Find all mentions of this sidebar item
    const allBlocks = await getBlocksByCampaign(ctx, args.campaignId)
    const matchingBlocks: Array<Block> = []

    for (const block of allBlocks) {
      const mentions = await getBlockMentions(ctx, args.campaignId, block._id)
      if (mentions.some((m) => m.sidebarItemId === args.sidebarItemId)) {
        matchingBlocks.push(block)
      }
    }

    return matchingBlocks
  },
})

export const getBlockMentionState = query({
  args: {
    noteId: v.id('notes'),
    blockId: v.string(),
  },
  returns: v.union(
    v.object({
      mentions: v.array(blockMentionValidator),
      inlineMentionIds: v.array(sidebarItemIdValidator),
    }),
    v.null(),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<{
    mentions: Array<BlockMention>
    inlineMentionIds: Array<SidebarItemId>
  } | null> => {
    const note = await ctx.db.get(args.noteId)
    if (!note) throw new Error('Note not found')

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    const block = await findBlockByBlockNoteId(ctx, args.noteId, args.blockId)
    if (!block) {
      return null
    }

    const mentions = await getBlockMentions(ctx, note.campaignId, block._id)
    const inlineMentions = extractMentionsFromBlockContent(block.content)
    const inlineMentionIds = inlineMentions.map((m) => m.sidebarItemId)

    return {
      mentions,
      inlineMentionIds,
    }
  },
})

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

/**
 * Get a block by its BlockNote string ID along with its share status and player members.
 * This query finds the block DIRECTLY by BlockNote ID - no mention tables involved.
 * Returns null if the block hasn't been saved to the database yet.
 *
 * Share status optimization:
 * - 'all_shared': Block visible to all players (shares array will be empty)
 * - 'not_shared': Block visible to no players (shares array will be empty)
 * - 'individually_shared': Must query blockShares table for specific shares
 */
export const getBlockWithShares = query({
  args: {
    noteId: v.id('notes'),
    blockId: v.string(), // BlockNote string ID (NOT database ID)
  },
  returns: v.union(
    v.object({
      block: blockValidator,
      shareStatus: blockShareStatusValidator,
      shares: v.array(blockShareValidator), // Only populated if individually_shared
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
    // 1. Get note and validate DM membership
    const note = await ctx.db.get(args.noteId)
    if (!note) throw new Error('Note not found')

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    // 2. Find block DIRECTLY by BlockNote ID using findBlockByBlockNoteId()
    //    Uses index: by_campaign_note_block - NO mention tables involved
    const block = await findBlockByBlockNoteId(ctx, args.noteId, args.blockId)
    if (!block) {
      // Block not saved to DB yet
      return null
    }

    // 3. Get share status (default to 'not_shared' for legacy blocks)
    const shareStatus: BlockShareStatus =
      block.shareStatus ?? BLOCK_SHARE_STATUS.NOT_SHARED

    // 4. Get player members (always needed for UI)
    const allMembers = await getCampaignMembers(ctx, note.campaignId)
    const playerMembers = allMembers.filter(
      (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
    )

    // 5. Only fetch individual shares if status is 'individually_shared'
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
