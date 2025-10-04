import { v } from 'convex/values'
import { query } from '../_generated/server'
import { sessionValidator } from './schema'
import { Session } from './types'
import {
  combineSessionAndTag,
  getCurrentSession as getCurrentSessionHandler,
} from './sessions'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { SYSTEM_TAG_CATEGORY_NAMES } from '../tags/types'
import { getTagCategoryByName, getTagsByCategory } from '../tags/tags'

export const getCurrentSession = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.union(v.null(), sessionValidator),
  handler: async (ctx, args): Promise<Session | null> => {
    return await getCurrentSessionHandler(ctx, args.campaignId)
  },
})

export const getSessionsByCampaign = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(sessionValidator),
  handler: async (ctx, args): Promise<Session[]> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    const category = await getTagCategoryByName(
      ctx,
      args.campaignId,
      SYSTEM_TAG_CATEGORY_NAMES.Session,
    )
    const tags = await getTagsByCategory(ctx, category._id)
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_campaign_tag_endedAt', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .collect()

    const sessionsByTagId = new Map(sessions.map((c) => [c.tagId, c]))

    return tags
      .map((t) => {
        const session = sessionsByTagId.get(t._id)
        if (!session) {
          console.warn(`Session not found for tag ${t._id}`)
          return null
        }
        return combineSessionAndTag(session, t)
      })
      .filter((s) => s !== null)
      .sort((a, b) => b._creationTime - a._creationTime)
  },
})
