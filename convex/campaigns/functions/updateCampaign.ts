import { ERROR_CODE, throwClientError } from '../../errors'
import { requireDmRole } from '../../functions'
import { validateCampaignName, validateCampaignSlug } from '../validation'
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
    const nameError = validateCampaignName(name.trim())
    if (nameError) throwClientError(ERROR_CODE.VALIDATION_FAILED, nameError)
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
    const trimmedSlug = slug.trim()
    const slugError = validateCampaignSlug(trimmedSlug)
    if (slugError) throwClientError(ERROR_CODE.VALIDATION_FAILED, slugError)
    const conflict = await ctx.db
      .query('campaigns')
      .withIndex('by_slug_dm', (q) =>
        q.eq('slug', trimmedSlug).eq('dmUserId', profile._id),
      )
      .unique()
    if (conflict && conflict._id !== campaign._id) {
      throwClientError(
        ERROR_CODE.CONFLICT,
        'A campaign with this slug already exists',
      )
    }
    updates.slug = trimmedSlug
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
