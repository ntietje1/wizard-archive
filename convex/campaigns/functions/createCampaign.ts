import { ERROR_CODE, throwClientError } from '../../errors'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from '../types'
import { validateCampaignName, validateCampaignSlug } from '../validation'
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

  const nameError = validateCampaignName(name)
  if (nameError) throwClientError(ERROR_CODE.VALIDATION_FAILED, nameError)

  const slugError = validateCampaignSlug(slug)
  if (slugError) throwClientError(ERROR_CODE.VALIDATION_FAILED, slugError)

  const profile = ctx.user.profile

  const conflict = await ctx.db
    .query('campaigns')
    .withIndex('by_slug_dm', (q) =>
      q.eq('slug', slug).eq('dmUserId', profile._id),
    )
    .unique()

  if (conflict) {
    throwClientError(
      ERROR_CODE.CONFLICT,
      'A campaign with this slug already exists',
    )
  }

  const campaignId = await ctx.db.insert('campaigns', {
    name,
    description: description ?? '',
    dmUserId: profile._id,
    slug,
    status: CAMPAIGN_STATUS.Active,
    currentSessionId: null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profile._id,
  })

  await ctx.db.insert('campaignMembers', {
    userId: profile._id,
    campaignId,
    role: CAMPAIGN_MEMBER_ROLE.DM,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profile._id,
  })

  return campaignId
}
