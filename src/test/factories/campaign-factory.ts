import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from 'convex/campaigns/types'
import { assertCampaignSlug } from 'convex/campaigns/validation'
import { createUser } from './user-factory'
import type { Campaign, CampaignMember } from 'convex/campaigns/types'
import { testId } from '~/test/helpers/test-id'

let campaignCounter = 0

type CreateCampaignOverrides = Omit<Partial<Campaign>, 'myMembership' | 'slug'> & {
  slug?: string
  myMembership?: Partial<CampaignMember> | null
}

export function createCampaign(overrides?: CreateCampaignOverrides): Campaign {
  campaignCounter++
  const dmUser = createUser()
  const campaignId = overrides?._id ?? testId(`campaign_${campaignCounter}`)
  const { myMembership: memberOverrides, slug, ...rest } = overrides ?? {}
  const campaign: Campaign = {
    _id: campaignId,
    _creationTime: Date.now(),
    dmUserId: dmUser._id,
    name: `Test Campaign ${campaignCounter}`,
    description: '',
    slug: assertCampaignSlug(slug ?? `test-campaign-${campaignCounter}`),
    status: CAMPAIGN_STATUS.Active,
    currentSessionId: null,
    dmUserProfile: dmUser,
    myMembership: memberOverrides ? createCampaignMember({ ...memberOverrides, campaignId }) : null,
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
    userProfile: user,
    ...overrides,
  }
}
