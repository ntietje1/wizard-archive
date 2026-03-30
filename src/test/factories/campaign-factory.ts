import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from 'convex/campaigns/types'
import { createUser } from './user-factory'
import type { Campaign, CampaignMember } from 'convex/campaigns/types'
import { testId } from '~/test/helpers/test-id'

let campaignCounter = 0

type CreateCampaignOverrides = Omit<Partial<Campaign>, 'myMembership'> & {
  myMembership?: Partial<CampaignMember> | null
}

export function createCampaign(overrides?: CreateCampaignOverrides): Campaign {
  campaignCounter++
  const dmUser = createUser()
  const campaignId = overrides?._id ?? testId(`campaign_${campaignCounter}`)
  const { myMembership: memberOverrides, ...rest } = overrides ?? {}
  const campaign: Campaign = {
    _id: campaignId,
    _creationTime: Date.now(),
    dmUserId: dmUser._id,
    name: `Test Campaign ${campaignCounter}`,
    description: '',
    slug: `test-campaign-${campaignCounter}`,
    status: CAMPAIGN_STATUS.Active,
    currentSessionId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: dmUser._id,
    deletionTime: null,
    deletedBy: null,
    dmUserProfile: dmUser,
    myMembership: memberOverrides
      ? createCampaignMember({ ...memberOverrides, campaignId })
      : null,
    playerCount: 0,
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
    _id: testId(`member_${memberCounter}`),
    _creationTime: Date.now(),
    userId: user._id,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    updatedTime: null,
    updatedBy: null,
    createdBy: user._id,
    deletionTime: null,
    deletedBy: null,
    userProfile: user,
    ...overrides,
  }
}
