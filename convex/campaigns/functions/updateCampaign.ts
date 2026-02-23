import { findUniqueSlug } from '../../common/slug'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

export async function updateCampaign(
  ctx: CampaignMutationCtx,
  name?: string,
  description?: string,
  slug?: string,
): Promise<Id<'campaigns'>> {
  const profile = ctx.user.profile
  const campaign = ctx.campaign

  const now = Date.now()

  const campaignUpdates: Partial<Doc<'campaigns'>> = {
    _updatedAt: now,
    _updatedBy: ctx.user.profile._id,
  }

  if (name !== undefined) {
    campaignUpdates.name = name
  }
  if (description !== undefined) {
    campaignUpdates.description = description
  }

  if (slug !== undefined && slug !== campaign.slug) {
    const uniqueSlug = await findUniqueSlug(slug, async (s) => {
      const conflict = await ctx.db
        .query('campaigns')
        .withIndex('by_slug_dm', (q) =>
          q.eq('slug', s).eq('dmUserId', profile._id),
        )
        .unique()
      return conflict !== null && conflict._id !== campaign._id
    })
    campaignUpdates.slug = uniqueSlug
  }

  await ctx.db.patch(campaign._id, campaignUpdates)

  return campaign._id
}
