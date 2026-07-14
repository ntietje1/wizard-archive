import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from 'shared/campaigns/types'
import { assertCampaignSlug } from 'shared/campaigns/validation'
import { createUser } from './user-factory'
import type { Campaign, CampaignMember } from 'shared/campaigns/types'
import { testCampaignId } from 'shared/test/campaign-id'
import { testCampaignMemberId } from 'shared/test/campaign-member-id'

let campaignCounter = 0

type CreateCampaignOverrides = Omit<Partial<Campaign>, 'myMembership' | 'slug'> & {
  slug?: string
  myMembership?: Partial<CampaignMember> | null
}

export function createCampaign(overrides?: CreateCampaignOverrides): Campaign {
  campaignCounter++
  const dmUser = createUser()
  const campaignId = overrides?.id ?? testCampaignId(`campaign_${campaignCounter}`)
  const {
    defaultFolderInheritShares = false,
    myMembership: memberOverrides,
    slug,
    ...rest
  } = overrides ?? {}
  const campaign: Campaign = {
    id: campaignId,
    createdAt: Date.now(),
    name: `Test Campaign ${campaignCounter}`,
    description: '',
    slug: assertCampaignSlug(slug ?? `test-campaign-${campaignCounter}`),
    status: CAMPAIGN_STATUS.Active,
    defaultFolderInheritShares,
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
    id: testCampaignMemberId(`member_${memberCounter}`),
    createdAt: Date.now(),
    userId: user.id,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    userProfile: user,
    ...overrides,
  }
}
