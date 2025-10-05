import { Id } from '../_generated/dataModel'
import { getUserIdentity, UserIdentityWithProfile } from '../common/identity'
import { Ctx } from '../common/types'
import { UserProfile } from '../users/types'
import {
  getUserProfileByUserIdHandler,
  getUserProfileByUsernameHandler,
} from '../users/users'
import {
  Campaign,
  CAMPAIGN_MEMBER_ROLE,
  CampaignMemberStatus,
  CampaignMemberRole,
  CampaignWithMembership,
  CAMPAIGN_MEMBER_STATUS,
  CampaignMember,
} from './types'

export type CampaignIdentifier =
  | { dmUsername: string; campaignSlug: string }
  | { campaignId: Id<'campaigns'> }

export interface getCampaignMembershipOptions {
  allowedStatuses?: ReadonlyArray<CampaignMemberStatus>
  allowedRoles?: ReadonlyArray<CampaignMemberRole>
}

export async function getCampaign(
  ctx: Ctx,
  campaignIdentifier: CampaignIdentifier,
): Promise<Campaign> {
  let campaign: Campaign
  if ('dmUsername' in campaignIdentifier) {
    const { dmUsername, campaignSlug } = campaignIdentifier
    const dmUserProfile = await getUserProfileByUsernameHandler(ctx, dmUsername)
    if (!dmUserProfile) throw new Error('Campaign not found')
    campaign = {
      ...(await ctx.db
        .query('campaigns')
        .withIndex('by_slug_dm', (q) =>
          q.eq('slug', campaignSlug).eq('dmUserId', dmUserProfile.userId),
        )
        .unique()),
      dmUserProfile,
    } as Campaign
  } else if ('campaignId' in campaignIdentifier) {
    const { campaignId } = campaignIdentifier
    const dmUserId = (await ctx.db.get(campaignId))?.dmUserId
    if (!dmUserId) throw new Error('Campaign not found')
    const dmUserProfile = await getUserProfileByUserIdHandler(ctx, dmUserId)
    if (!dmUserProfile) throw new Error('Campaign not found')
    campaign = {
      ...(await ctx.db.get(campaignId)),
      dmUserProfile: dmUserProfile,
    } as Campaign
  } else {
    throw new Error('Invalid campaign identifier')
  }
  return campaign
}

export async function getCampaignMember(
  ctx: Ctx,
  memberId: Id<'campaignMembers'>,
): Promise<CampaignMember | null> {
  const member = await ctx.db.get(memberId)
  if (!member) {
    return null
  }
  const userProfile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('userId', member.userId))
    .unique()

  if (!userProfile) {
    throw new Error('User profile not found')
  }
  return {
    ...member,
    userProfile,
  }
}

export async function getCampaignMembers(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
): Promise<CampaignMember[]> {
  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
    .collect()
  const profilesByUserId = new Map<string, UserProfile>()
  await Promise.all(
    members.map(async (member) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_user', (q) => q.eq('userId', member.userId))
        .unique()
      if (profile) profilesByUserId.set(member.userId, profile)
    }),
  )
  return members.map((member) => {
    const profile = profilesByUserId.get(member.userId)
    if (!profile) {
      throw new Error('User profile not found')
    }
    return {
    ...member,
    userProfile: profile,
    }
  })
}

export async function getCampaignMembership(
  ctx: Ctx,
  campaignIdentifier: CampaignIdentifier,
  options?: getCampaignMembershipOptions,
): Promise<{
  identityWithProfile: UserIdentityWithProfile | null
  campaignWithMembership: CampaignWithMembership | null
}> {
  const identityWithProfile = await getUserIdentity(ctx)
  if (!identityWithProfile)
    return { identityWithProfile: null, campaignWithMembership: null }
  const { identity } = identityWithProfile

  const campaign = await getCampaign(ctx, campaignIdentifier)

  if (!campaign)
    return {
      identityWithProfile: identityWithProfile,
      campaignWithMembership: null,
    }

  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
    .collect()
  const allowedStatuses = options?.allowedStatuses ?? [
    CAMPAIGN_MEMBER_STATUS.Accepted,
  ]
  const allowedRoles =
    options?.allowedRoles ?? Object.values(CAMPAIGN_MEMBER_ROLE)
  const campaignMember =
    members.find((m) => {
      return (
        m.userId === identity.subject &&
        allowedStatuses.includes(m.status) &&
        allowedRoles.includes(m.role)
      )
    }) ?? null

  if (!campaignMember)
    return {
      identityWithProfile: identityWithProfile,
      campaignWithMembership: null,
    }

  const campaignWithMembership: CampaignWithMembership = {
    campaign,
    member: {
      ...campaignMember,
      userProfile: identityWithProfile.profile,
    },
  }

  return {
    identityWithProfile: identityWithProfile,
    campaignWithMembership: campaignWithMembership,
  }
}

export async function requireCampaignMembership(
  ctx: Ctx,
  campaignIdentifier: CampaignIdentifier,
  options?: getCampaignMembershipOptions,
): Promise<{
  identityWithProfile: UserIdentityWithProfile
  campaignWithMembership: CampaignWithMembership
}> {
  const { identityWithProfile, campaignWithMembership } =
    await getCampaignMembership(ctx, campaignIdentifier, options)
  const requiresDm =
    options?.allowedRoles?.length === 1 &&
    options.allowedRoles[0] === CAMPAIGN_MEMBER_ROLE.DM
  if (!identityWithProfile || !campaignWithMembership)
    throw new Error(requiresDm ? 'Not a DM' : 'Not a campaign member')
  return { identityWithProfile, campaignWithMembership }
}
