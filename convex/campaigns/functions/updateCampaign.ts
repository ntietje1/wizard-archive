import { prepareCampaignDescription } from '../../../shared/campaigns/validation'
import { prepareCampaignName } from '../validation'
import type { WithoutSystemFields } from 'convex/server'
import type { Doc } from '../../_generated/dataModel'
import type { DmMutationCtx } from '../../functions'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceAccessDefaults } from '@wizard-archive/editor/resources/access-policy'
import type { CampaignSlug } from '../../../shared/campaigns/validation'
import { assertAvailableCampaignSlug } from './campaignSlug'

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
  const updates: Partial<WithoutSystemFields<Doc<'campaigns'>>> = {}

  if (name !== undefined) {
    updates.name = prepareCampaignName(name)
  }
  if (description !== undefined) {
    updates.description = prepareCampaignDescription(description) ?? ''
  }
  if (slug !== undefined && slug !== campaign.slug) {
    await assertAvailableCampaignSlug(ctx.db, campaign.dmUserId, slug, campaign._id)
    updates.slug = slug
  }
  if (resourceAccessDefaults !== undefined) {
    updates.resourceAccessDefaults = resourceAccessDefaults
  }

  if (Object.keys(updates).length === 0) {
    return assertDomainId(DOMAIN_ID_KIND.campaign, campaign.campaignUuid)
  }

  await ctx.db.patch('campaigns', campaign._id, updates)

  return assertDomainId(DOMAIN_ID_KIND.campaign, campaign.campaignUuid)
}
