import { Share } from './types'
import { Id } from '../_generated/dataModel'
import { Ctx } from '../common/types'
import { MutationCtx } from '../_generated/server'
import {
  getCampaignMember,
  requireCampaignMembership,
} from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE, CampaignMember } from '../campaigns/types'
import {
  combineTagEntity,
  getEffectiveTagIdsForBlock,
  getTagCategory,
  getTagCategoryBySlug,
  getTagsByCategory,
  insertTagAndNote,
} from '../tags/tags'
import { SYSTEM_DEFAULT_CATEGORIES } from '../tags/types'

export const combineSharesAndTag = (
  share: { _id: Id<'shares'> },
  tag: { _id: Id<'tags'> },
  category?: { _id: Id<'tagCategories'> },
): Share => combineTagEntity<Share>('shareId', share, tag, category)

export const getShare = async (
  ctx: Ctx,
  shareId: Id<'shares'>,
): Promise<Share | null> => {
  const share = await ctx.db.get(shareId)
  if (!share) {
    return null
  }
  let member: CampaignMember | undefined
  if (share.memberId) {
    member = (await getCampaignMember(ctx, share.memberId)) || undefined
  }
  const tag = await ctx.db.get(share.tagId)
  if (!tag) {
    return null
  }
  const category = await getTagCategory(ctx, tag.campaignId, tag.categoryId)
  return { ...combineSharesAndTag(share, tag, category), member }
}

export const createShare = async (
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  memberId: Id<'campaignMembers'> | null,
): Promise<{
  tagId: Id<'tags'>
  shareId: Id<'shares'>
}> => {
  const category = await getTagCategoryBySlug(
    ctx,
    campaignId,
    SYSTEM_DEFAULT_CATEGORIES.Shared.slug,
  )
  if (!category) {
    throw new Error(
      `System tag category "${SYSTEM_DEFAULT_CATEGORIES.Shared.slug}" not found`,
    )
  }
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )
  const { tagId } = await insertTagAndNote(
    ctx,
    memberId
      ? {
          name: 'Shared: (Player)',
          color: '#F59E0B',
          description: 'Visible to a specific player',
          campaignId,
          categoryId: category._id,
        }
      : {
          name: 'Shared: (All)',
          color: '#F59E0B',
          description: 'Visible to all players',
          campaignId,
          categoryId: category._id,
        },
    category._id,
    true,
  )

  const shareId = await ctx.db.insert('shares', {
    campaignId,
    tagId,
    memberId: memberId || undefined,
  })

  return { tagId, shareId }
}

export async function getSharedAllTag(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
): Promise<Share> {
  const allShare = await ctx.db
    .query('shares')
    .withIndex('by_campaign_member', (q) =>
      q.eq('campaignId', campaignId).eq('memberId', undefined),
    )
    .unique()
  if (!allShare) {
    throw new Error('All shared tag should exist but was not found')
  }
  const share = await getShare(ctx, allShare._id)
  if (!share) {
    throw new Error('All shared tag should exist but was not found')
  }
  return share
}

export async function ensureSharedAllTag(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
): Promise<Id<'tags'>> {
  try {
    return (await getSharedAllTag(ctx, campaignId))._id
  } catch (error) {
    console.error('Missing shared all tag', error)
    return await createShare(ctx, campaignId, null).then((s) => s.tagId)
  }
}

export async function getPlayerSharedTags(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
): Promise<Share[]> {
  const category = await getTagCategoryBySlug(
    ctx,
    campaignId,
    SYSTEM_DEFAULT_CATEGORIES.Shared.slug,
  )
  if (!category) {
    throw new Error(
      `System tag category "${SYSTEM_DEFAULT_CATEGORIES.Shared.slug}" not found`,
    )
  }
  const tags = await getTagsByCategory(ctx, category._id)
  const shares = await ctx.db
    .query('shares')
    .withIndex('by_campaign_tag', (q) => q.eq('campaignId', campaignId))
    .collect()

  const sharesByTagId = new Map(shares.map((c) => [c.tagId, c]))

  return tags
    .map((t) => {
      const share = sharesByTagId.get(t._id)
      if (!share) {
        console.warn(`Share not found for tag ${t._id}`)
        return null
      }
      return combineSharesAndTag(share, t, category)
    })
    .filter((s) => s !== null)
    .filter((s) => !!s.memberId)
    .sort((a, b) => b._creationTime - a._creationTime)
}

export async function getPlayerSharedTag(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  memberId: Id<'campaignMembers'>,
): Promise<Share> {
  const category = await getTagCategoryBySlug(
    ctx,
    campaignId,
    SYSTEM_DEFAULT_CATEGORIES.Shared.slug,
  )
  if (!category) {
    throw new Error(
      `System tag category "${SYSTEM_DEFAULT_CATEGORIES.Shared.slug}" not found`,
    )
  }
  const playerShare = await ctx.db
    .query('shares')
    .withIndex('by_campaign_member', (q) =>
      q.eq('campaignId', campaignId).eq('memberId', memberId),
    )
    .unique()
  if (!playerShare) {
    throw new Error('Player shared tag should exist but was not found')
  }
  const playerSharedTag = await ctx.db.get(playerShare.tagId)
  if (!playerSharedTag) {
    throw new Error('Player shared tag should exist but was not found')
  }
  return combineSharesAndTag(playerShare, playerSharedTag, category)
}

export async function ensurePlayerSharedTag(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  memberId: Id<'campaignMembers'>,
): Promise<Id<'tags'>> {
  try {
    return (await getPlayerSharedTag(ctx, campaignId, memberId))._id
  } catch (error) {
    console.error('Missing player shared tag', error)
    return await createShare(ctx, campaignId, memberId).then((s) => s.tagId)
  }
}

export async function ensureAllPlayerSharedTags(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
): Promise<void> {
  const campaignMembers = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
    .collect()

  for (const member of campaignMembers) {
    await ensurePlayerSharedTag(ctx, campaignId, member._id)
  }
}

export async function hasAccessToBlock(
  ctx: Ctx,
  memberId: Id<'campaignMembers'>,
  blockId: Id<'blocks'>,
): Promise<boolean> {
  const block = await ctx.db.get(blockId)
  if (!block) {
    throw new Error('Block not found')
  }
  const campaignId = block.campaignId
  const sharedAllTag = await getSharedAllTag(ctx, campaignId)
  const playerSharedTag = await getPlayerSharedTag(ctx, campaignId, memberId)
  const blockTagIds = await getEffectiveTagIdsForBlock(ctx, blockId)
  return (
    blockTagIds.includes(sharedAllTag._id) ||
    blockTagIds.includes(playerSharedTag._id)
  )
}
