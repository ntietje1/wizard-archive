import type { Id } from '../../_generated/dataModel'
import type { AuthQueryCtx } from '../../functions'

export async function checkCampaignSlugExists(
  ctx: AuthQueryCtx,
  {
    slug,
    excludeCampaignId,
  }: { slug: string; excludeCampaignId: Id<'campaigns'> | undefined },
): Promise<boolean> {
  const existingCampaign = await ctx.db
    .query('campaigns')
    .withIndex('by_slug_dm', (q) =>
      q.eq('slug', slug).eq('dmUserId', ctx.user.profile._id),
    )
    .unique()

  if (!existingCampaign) {
    return false
  }

  if (excludeCampaignId && existingCampaign._id === excludeCampaignId) {
    return false
  }

  return true
}
