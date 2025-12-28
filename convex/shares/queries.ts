import { v } from 'convex/values'
import { query } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import {
  getCampaignMembers,
  requireCampaignMembership,
} from '../campaigns/campaigns'
import { getTagCategoryBySlug, getTagsByCategory } from '../tags/tags'
import { SYSTEM_DEFAULT_CATEGORIES } from '../tags/types'
import { shareValidator } from './schema'
import { combineSharesAndTag } from './shares'
import type { Share } from './types'

export const getShareTagsByCampaign = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(shareValidator),
  handler: async (ctx, args): Promise<Array<Share>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const category = await getTagCategoryBySlug(
      ctx,
      args.campaignId,
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
      .withIndex('by_campaign_tag', (q) => q.eq('campaignId', args.campaignId))
      .collect()

    const sharesByTagId = new Map(shares.map((c) => [c.tagId, c]))
    const members = await getCampaignMembers(ctx, args.campaignId)

    return tags
      .map((t) => {
        const share = sharesByTagId.get(t._id)
        if (!share) {
          console.warn(`Share not found for tag ${t._id}`)
          return null
        }
        return {
          ...combineSharesAndTag(share, t, category),
          member: members.find((m) => m._id === share.memberId),
        }
      })
      .filter((s) => s !== null)
      .sort((a, b) => b._creationTime - a._creationTime)
  },
})
