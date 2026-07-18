import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from 'shared/campaigns/types'
import { assertCampaignSlug } from 'shared/campaigns/validation'
import { createUser } from './user-factory'
import type { Campaign, CampaignMember } from 'shared/campaigns/types'
import { testDomainId } from 'shared/test/domain-id'
import { DEFAULT_RESOURCE_ACCESS_DEFAULTS } from '@wizard-archive/editor/resources/access-policy'

let campaignCounter = 0

type CreateCampaignOverrides = Omit<Partial<Campaign>, 'myMembership' | 'slug'> & {
  slug?: string
  myMembership?: Partial<CampaignMember> | null
}

export function createCampaign(overrides?: CreateCampaignOverrides): Campaign {
  campaignCounter++
  const dmUser = createUser()
  const campaignId = overrides?.id ?? testDomainId('campaign', `campaign_${campaignCounter}`)
  const { myMembership: memberOverrides, slug, ...rest } = overrides ?? {}
  const campaign: Campaign = {
    id: campaignId,
    createdAt: Date.now(),
    name: `Test Campaign ${campaignCounter}`,
    description: '',
    slug: assertCampaignSlug(slug ?? `test-campaign-${campaignCounter}`),
    status: CAMPAIGN_STATUS.Active,
    resourceAccessDefaults: DEFAULT_RESOURCE_ACCESS_DEFAULTS,
    dmUserProfile: dmUser,
    myMembership: memberOverrides ? createCampaignMember({ ...memberOverrides, campaignId }) : null,
    acceptedMemberCount: 0,
    ...rest,
  }
  return campaign
}

let memberCounter = 0

export function createCampaignMember(
  overrides: Partial<CampaignMember> & Pick<CampaignMember, 'campaignId'>,
): CampaignMember {
  memberCounter++
  const user = createUser()
  return {
    id: testDomainId('campaignMember', `member_${memberCounter}`),
    createdAt: Date.now(),
    userId: user.id,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    userProfile: user,
    ...overrides,
  }
}
