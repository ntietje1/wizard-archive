import type { CampaignSlug } from '../../../shared/campaigns/validation'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from '../../../shared/campaigns/types'
import { prepareCampaignDescription } from '../../../shared/campaigns/validation'
import { prepareCampaignName } from '../validation'
import type { AuthMutationCtx } from '../../functions'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'

export async function createCampaign(
  ctx: AuthMutationCtx,
  {
    name,
    slug,
    description,
  }: {
    name: string
    slug: CampaignSlug
    description?: string
  },
): Promise<CampaignId> {
  const preparedName = prepareCampaignName(name)
  const preparedDescription = prepareCampaignDescription(description)

  const profile = ctx.user.profile
  const campaignUuid = generateDomainId(DOMAIN_ID_KIND.campaign)

  const conflict = await ctx.db
    .query('campaigns')
    .withIndex('by_slug_dm', (q) => q.eq('slug', slug).eq('dmUserId', profile._id))
    .unique()

  if (conflict) {
    throwClientError(ERROR_CODE.CONFLICT, 'A campaign with this slug already exists')
  }

  const campaignId = await ctx.db.insert('campaigns', {
    campaignUuid,
    name: preparedName,
    description: preparedDescription ?? '',
    dmUserId: profile._id,
    slug,
    status: CAMPAIGN_STATUS.Active,
    currentSessionId: null,
    defaultFolderInheritShares: false,
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
