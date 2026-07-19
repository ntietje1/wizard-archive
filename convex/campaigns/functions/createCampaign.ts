import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from '../../../shared/campaigns/types'
import { prepareCampaignDescription } from '../../../shared/campaigns/validation'
import { prepareCampaignName } from '../validation'
import type { AuthMutationCtx } from '../../functions'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { DEFAULT_RESOURCE_ACCESS_DEFAULTS } from '@wizard-archive/editor/resources/access-policy'

export async function createCampaign(
  ctx: AuthMutationCtx,
  {
    name,
    description,
  }: {
    name: string
    description?: string
  },
): Promise<CampaignId> {
  const preparedName = prepareCampaignName(name)
  const preparedDescription = prepareCampaignDescription(description)

  const profile = ctx.user.profile
  const campaignUuid = generateDomainId(DOMAIN_ID_KIND.campaign)

  const campaignId = await ctx.db.insert('campaigns', {
    campaignUuid,
    name: preparedName,
    description: preparedDescription ?? '',
    dmUserId: profile._id,
    status: CAMPAIGN_STATUS.Active,
    acceptedMemberCount: 1,
    currentSessionId: null,
    resourceAccessDefaults: DEFAULT_RESOURCE_ACCESS_DEFAULTS,
  })

  await ctx.db.insert('campaignMembers', {
    campaignMemberUuid: generateDomainId(DOMAIN_ID_KIND.campaignMember),
    userId: profile._id,
    campaignId,
    role: CAMPAIGN_MEMBER_ROLE.DM,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
  })

  return campaignUuid
}
