import { getUserIdentity } from '../common/identity'
import { getUserProfileByUsernameHandler } from '../users/users'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS
} from './types'
import type { Id } from '../_generated/dataModel'
import type { UserIdentityWithProfile } from '../common/identity';
import type { Ctx } from '../common/types'
import type { UserProfile } from '../users/types'
import type {
  Campaign,
  CampaignMember,
  CampaignMemberRole,
  CampaignMemberStatus,
  CampaignWithMembership} from './types';

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
    const partialCampaign = await ctx.db
      .query('campaigns')
      .withIndex('by_slug_dm', (q) =>
        q.eq('slug', campaignSlug).eq('dmUserId', dmUserProfile._id),
      )
      .unique()
    if (!partialCampaign) throw new Error('Campaign not found')
    campaign = {
      ...partialCampaign,
      dmUserProfile,
    } as Campaign
  } else if ('campaignId' in campaignIdentifier) {
    const { campaignId } = campaignIdentifier
    const partialCampaign = await ctx.db.get(campaignId)
    if (!partialCampaign) throw new Error('Campaign not found')
    const dmUserProfile = await ctx.db.get(partialCampaign.dmUserId)
    if (!dmUserProfile) throw new Error('Campaign not found')
    campaign = {
      ...partialCampaign,
      dmUserProfile,
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
  const userProfile = await ctx.db.get(member.userId)
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
): Promise<Array<CampaignMember>> {
  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
    .collect()
  const profilesByUserId = new Map<string, UserProfile>()
  await Promise.all(
    members.map(async (member) => {
      const profile = await ctx.db.get(member.userId)
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

  const campaign = await getCampaign(ctx, campaignIdentifier)

  if (!campaign)
    return {
      identityWithProfile,
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
        m.userId === identityWithProfile.profile._id &&
        allowedStatuses.includes(m.status) &&
        allowedRoles.includes(m.role)
      )
    }) ?? null

  if (!campaignMember)
    return {
      identityWithProfile,
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
    identityWithProfile,
    campaignWithMembership,
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
