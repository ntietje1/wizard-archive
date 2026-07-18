import type { CampaignSlug } from '../../../shared/campaigns/validation'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { prepareCampaignDescription } from '../../../shared/campaigns/validation'
import { prepareCampaignName } from '../validation'
import type { WithoutSystemFields } from 'convex/server'
import type { Doc } from '../../_generated/dataModel'
import type { DmMutationCtx } from '../../functions'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceAccessDefaults } from '@wizard-archive/editor/resources/access-policy'

export async function updateCampaign(
  ctx: DmMutationCtx,
  {
    name,
    description,
    slug,
    resourceAccessDefaults,
  }: {
    name?: string
    description?: string
    slug?: CampaignSlug
    resourceAccessDefaults?: ResourceAccessDefaults
  },
): Promise<CampaignId> {
  const campaign = ctx.campaign
  const userId = ctx.membership.userId

  const updates: Partial<WithoutSystemFields<Doc<'campaigns'>>> = {}

  if (name !== undefined) {
    updates.name = prepareCampaignName(name)
  }
  if (description !== undefined) {
    updates.description = prepareCampaignDescription(description) ?? ''
  }
  if (resourceAccessDefaults !== undefined) {
    updates.resourceAccessDefaults = resourceAccessDefaults
  }

  if (slug !== undefined && slug !== campaign.slug) {
    const conflict = await ctx.db
      .query('campaigns')
      .withIndex('by_slug_dm', (q) => q.eq('slug', slug).eq('dmUserId', userId))
      .unique()
    if (conflict) {
      throwClientError(ERROR_CODE.CONFLICT, 'A campaign with this slug already exists')
    }
    updates.slug = slug
  }

  if (Object.keys(updates).length === 0) {
    return assertDomainId(DOMAIN_ID_KIND.campaign, campaign.campaignUuid)
  }

  await ctx.db.patch('campaigns', campaign._id, updates)

  return assertDomainId(DOMAIN_ID_KIND.campaign, campaign.campaignUuid)
}
