import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../shared/campaigns/types'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { DEFAULT_RESOURCE_ACCESS_DEFAULTS } from '@wizard-archive/editor/resources/access-policy'
import type { ResourceAccessDefaults } from '@wizard-archive/editor/resources/access-policy'
import { assertUsername } from '../users/validation'
import type { TestConvex } from 'convex-test'
import type { Id } from '../_generated/dataModel'
import type schema from '../schema'
import { campaignSlugFromName } from '../../shared/campaigns/validation'

type T = TestConvex<typeof schema>

let counter = 0

function nextId() {
  return ++counter
}

export async function getCampaignRowId(t: T, campaignId: CampaignId) {
  const campaign = await t.run(async (ctx) => {
    return await ctx.db
      .query('campaigns')
      .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
      .unique()
  })
  if (!campaign) throw new Error('Campaign not found')
  return campaign._id
}

export async function createUserProfile(
  t: T,
  overrides?: Partial<{
    authUserId: string
    username: string
    email: string | null
    emailVerified: boolean | null
    name: string | null
    profileImage:
      | { type: 'external'; url: string }
      | { type: 'storage'; storageId: Id<'_storage'> }
      | null
    twoFactorEnabled: boolean | null
  }>,
) {
  const n = nextId()
  const { username, ...rest } = overrides ?? {}
  const data = {
    userProfileUuid: generateDomainId(DOMAIN_ID_KIND.userProfile),
    authUserId: `auth-user-${n}`,
    username: assertUsername(username ?? `user-${n}`),
    email: `user-${n}@test.com`,
    emailVerified: null,
    name: `Test User ${n}`,
    profileImage: null,
    twoFactorEnabled: null,
    ...rest,
  }
  const rowId = await t.run(async (ctx) => await ctx.db.insert('userProfiles', data))
  return { _id: rowId, ...data }
}

export async function createCampaignWithDm(
  t: T,
  dmProfile: { _id: Id<'userProfiles'> },
  overrides?: Partial<{
    name: string
    description: string
    slug: string
    status: 'Active' | 'Inactive'
    currentSessionId: Id<'sessions'> | null
    resourceAccessDefaults: ResourceAccessDefaults
  }>,
) {
  const n = nextId()
  const campaignData = {
    campaignUuid: generateDomainId(DOMAIN_ID_KIND.campaign),
    name: `Campaign ${n}`,
    slug: campaignSlugFromName(overrides?.name ?? `Campaign ${n}`),
    description: '',
    dmUserId: dmProfile._id,
    status: 'Active' as const,
    acceptedMemberCount: 1,
    currentSessionId: null,
    resourceAccessDefaults: DEFAULT_RESOURCE_ACCESS_DEFAULTS,
    ...overrides,
  }
  const campaignId = await t.run(async (ctx) => await ctx.db.insert('campaigns', campaignData))
  const dmMemberDomainId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
  const memberId = await t.run(async (ctx) => {
    return await ctx.db.insert('campaignMembers', {
      campaignMemberUuid: dmMemberDomainId,
      userId: dmProfile._id,
      campaignId,
      role: CAMPAIGN_MEMBER_ROLE.DM,
      status: CAMPAIGN_MEMBER_STATUS.Accepted,
    })
  })
  return {
    campaignId,
    campaignDomainId: campaignData.campaignUuid,
    slug: campaignData.slug,
    dmMemberId: memberId,
    dmMemberDomainId,
  }
}

export async function addPlayerToCampaign(
  t: T,
  campaignId: Id<'campaigns'>,
  playerProfile: { _id: Id<'userProfiles'> },
  overrides?: Partial<{ status: 'Pending' | 'Accepted' | 'Rejected' | 'Removed' }>,
) {
  const data = {
    campaignMemberUuid: generateDomainId(DOMAIN_ID_KIND.campaignMember),
    userId: playerProfile._id,
    campaignId,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    ...overrides,
  }
  const memberId = await t.run(async (ctx) => {
    const id = await ctx.db.insert('campaignMembers', data)
    if (data.status === CAMPAIGN_MEMBER_STATUS.Accepted) {
      const campaign = await ctx.db.get('campaigns', campaignId)
      if (!campaign) throw new Error('Campaign not found')
      await ctx.db.patch('campaigns', campaignId, {
        acceptedMemberCount: campaign.acceptedMemberCount + 1,
      })
    }
    return id
  })
  return { memberId, memberDomainId: data.campaignMemberUuid, ...data }
}

export async function createSession(
  t: T,
  campaignId: Id<'campaigns'>,
  overrides?: Partial<{ name: string | null; startedAt: number; endedAt: number | null }>,
) {
  const data = {
    sessionUuid: generateDomainId(DOMAIN_ID_KIND.session),
    campaignId,
    name: null,
    startedAt: Date.now(),
    endedAt: null,
    ...overrides,
  }
  const sessionId = await t.run(async (ctx) => await ctx.db.insert('sessions', data))
  return { sessionId, ...data }
}
