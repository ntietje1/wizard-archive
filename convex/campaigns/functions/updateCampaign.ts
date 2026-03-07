import { findUniqueSlug } from '../../common/slug'
import { requireDmRole } from '../../functions'
import type { WithoutSystemFields } from 'convex/server'
import type { Doc, Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function updateCampaign(
  ctx: AuthMutationCtx,
  {
    name,
    description,
    slug,
    campaignId,
  }: {
    name?: string
    description?: string
    slug?: string
    campaignId: Id<'campaigns'>
  },
): Promise<Id<'campaigns'>> {
  const { campaign } = await requireDmRole(ctx, campaignId)
  const profile = ctx.user.profile

  const updates: Partial<WithoutSystemFields<Doc<'campaigns'>>> = {}

  if (name !== undefined && name.trim().length > 0) {
    updates.name = name.trim()
  }
  if (description !== undefined) {
    updates.description = description.trim()
  }

  if (
    slug !== undefined &&
    slug.trim().length > 0 &&
    slug.trim() !== campaign.slug
  ) {
    slug = slug.trim()
    const uniqueSlug = await findUniqueSlug(slug, async (s) => {
      const conflict = await ctx.db
        .query('campaigns')
        .withIndex('by_slug_dm', (q) =>
          q.eq('slug', s).eq('dmUserId', profile._id),
        )
        .unique()
      return conflict !== null && conflict._id !== campaign._id
    })
    updates.slug = uniqueSlug
  }

  if (Object.keys(updates).length === 0) {
    return campaign._id
  }

  await ctx.db.patch(campaign._id, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  return campaign._id
}
