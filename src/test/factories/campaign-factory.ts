import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from 'shared/campaigns/types'
import { assertCampaignSlug } from 'shared/campaigns/validation'
import { createUser } from './user-factory'
import type { Campaign, CampaignMember } from 'shared/campaigns/types'
import { testId } from '~/test/helpers/test-id'

let campaignCounter = 0

type CreateCampaignOverrides = Omit<Partial<Campaign>, 'myMembership' | 'slug'> & {
  slug?: string
  myMembership?: Partial<CampaignMember> | null
}

export function createCampaign(overrides?: CreateCampaignOverrides): Campaign {
  campaignCounter++
  const dmUser = createUser()
  const campaignId = overrides?.id ?? testId(`campaign_${campaignCounter}`)
  const {
    defaultFolderInheritShares = false,
    myMembership: memberOverrides,
    slug,
    ...rest
  } = overrides ?? {}
  const campaign: Campaign = {
    id: campaignId,
    campaignUuid: `0198a000-0000-7000-8000-${campaignCounter.toString().padStart(12, '0')}`,
    createdAt: Date.now(),
    dmUserId: dmUser.id,
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
    id: testId(`member_${memberCounter}`),
    campaignMemberUuid: `0198b000-0000-7000-8000-${memberCounter.toString().padStart(12, '0')}`,
    createdAt: Date.now(),
    userId: user.id,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    userProfile: user,
    ...overrides,
  }
}
