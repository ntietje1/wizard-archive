import { findUniqueSlug } from '../../common/slug'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from '../types'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function createCampaign(
  ctx: AuthMutationCtx,
  {
    name,
    slug,
    description,
  }: {
    name: string
    slug: string
    description?: string
  },
): Promise<Id<'campaigns'>> {
  name = name.trim()
  slug = slug.trim()
  description = description?.trim()

  const profile = ctx.user.profile
  const now = Date.now()

  const uniqueSlug = await findUniqueSlug(slug, async (s) => {
    const conflict = await ctx.db
      .query('campaigns')
      .withIndex('by_slug_dm', (q) =>
        q.eq('slug', s).eq('dmUserId', profile._id),
      )
      .unique()
    return conflict !== null
  })

  const campaignId = await ctx.db.insert('campaigns', {
    name,
    description: description ?? '',
    dmUserId: profile._id,
    slug: uniqueSlug,
    status: CAMPAIGN_STATUS.Active,
    currentSessionId: null,
    updatedTime: now,
    updatedBy: profile._id,
    createdBy: profile._id,
  })

  await ctx.db.insert('campaignMembers', {
    userId: profile._id,
    campaignId,
    role: CAMPAIGN_MEMBER_ROLE.DM,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    updatedTime: now,
    updatedBy: profile._id,
    createdBy: profile._id,
  })

  return campaignId
}
