import { ERROR_CODE, throwClientError } from '../../errors'
import { validateCampaignName, validateCampaignSlug } from '../validation'
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
    slug?: string
  },
): Promise<Id<'campaigns'>> {
  const campaign = ctx.campaign
  const userId = ctx.membership.userId

  const updates: Partial<WithoutSystemFields<Doc<'campaigns'>>> = {}

  if (name !== undefined) {
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Campaign name cannot be empty')
    }
    const nameError = validateCampaignName(trimmedName)
    if (nameError) throwClientError(ERROR_CODE.VALIDATION_FAILED, nameError)
    updates.name = trimmedName
  }
  if (description !== undefined) {
    updates.description = description.trim()
  }

  if (slug !== undefined && slug.trim().length > 0 && slug.trim() !== campaign.slug) {
    const trimmedSlug = slug.trim()
    const slugError = validateCampaignSlug(trimmedSlug)
    if (slugError) throwClientError(ERROR_CODE.VALIDATION_FAILED, slugError)
    const conflict = await ctx.db
      .query('campaigns')
      .withIndex('by_slug_dm', (q) => q.eq('slug', trimmedSlug).eq('dmUserId', userId))
      .unique()
    if (conflict && conflict._id !== campaign._id) {
      throwClientError(ERROR_CODE.CONFLICT, 'A campaign with this slug already exists')
    }
    updates.slug = trimmedSlug
  }

  if (Object.keys(updates).length === 0) {
    return campaign._id
  }

  await ctx.db.patch('campaigns', campaign._id, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: userId,
  })

  return campaign._id
}
