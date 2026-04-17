import type { CampaignSlug } from '../validation'
import { ERROR_CODE, throwClientError } from '../../errors'
import { prepareCampaignDescription, prepareCampaignName } from '../validation'
import type { WithoutSystemFields } from 'convex/server'
import type { Doc, Id } from '../../_generated/dataModel'
import type { DmMutationCtx } from '../../functions'

export async function updateCampaign(
  ctx: DmMutationCtx,
  {
    name,
    description,
    slug,
  }: {
    name?: string
    description?: string
    slug?: CampaignSlug
  },
): Promise<Id<'campaigns'>> {
  const campaign = ctx.campaign
  const userId = ctx.membership.userId

  const updates: Partial<WithoutSystemFields<Doc<'campaigns'>>> = {}

  if (name !== undefined) {
    updates.name = prepareCampaignName(name)
  }
  if (description !== undefined) {
    updates.description = prepareCampaignDescription(description) ?? ''
  }

  if (slug !== undefined && slug !== campaign.slug) {
    const conflict = await ctx.db
      .query('campaigns')
      .withIndex('by_slug_dm', (q) => q.eq('slug', slug).eq('dmUserId', userId))
      .unique()
    if (conflict && conflict._id !== campaign._id) {
      throwClientError(ERROR_CODE.CONFLICT, 'A campaign with this slug already exists')
    }
    updates.slug = slug
  }

  if (Object.keys(updates).length === 0) {
    return campaign._id
  }

  await ctx.db.patch('campaigns', campaign._id, updates)

  return campaign._id
}
