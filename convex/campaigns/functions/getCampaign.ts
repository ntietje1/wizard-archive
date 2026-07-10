import { assertCampaignSlug } from '../validation'
import type { CampaignSlug } from '../../../shared/campaigns/validation'
import type { Username } from '../../../shared/users/validation'
import { getAuthProfileKey } from '../../auth/identity'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_STATUS, CAMPAIGN_STATUS } from '../../../shared/campaigns/types'
import {
  getUserProfileByAuthProfileKey,
  getUserProfileById,
  getUserProfileByUsername,
} from '../../users/functions/getUserProfile'
import { toUserProfileSummary } from '../../users/functions/profileSummary'
import type { AuthQueryCtx } from '../../functions'
import type {
  Campaign,
  CampaignRow,
  CampaignMemberSummary,
  CampaignMemberRow,
} from '../../../shared/campaigns/types'
import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'

function toCampaignRow(campaign: Doc<'campaigns'>): CampaignRow {
  return {
    ...campaign,
    slug: assertCampaignSlug(campaign.slug),
    defaultFolderInheritShares: campaign.defaultFolderInheritShares ?? false,
  }
}

function toCampaign(
  campaign: CampaignRow,
): Omit<Campaign, 'dmUserProfile' | 'myMembership' | 'acceptedMemberCount'> {
  const { _id, _creationTime, ...rest } = campaign
  return { ...rest, id: _id, createdAt: _creationTime }
}

function toCampaignMemberSummary(
  member: CampaignMemberRow,
  userProfile: CampaignMemberSummary['userProfile'],
): CampaignMemberSummary {
  const { _id, _creationTime, ...rest } = member
  return { ...rest, id: _id, createdAt: _creationTime, userProfile }
}

async function countAcceptedMembers(
  ctx: QueryCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<number> {
  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
    .collect()
  return members.filter((m) => m.status === CAMPAIGN_MEMBER_STATUS.Accepted).length
}

async function enhanceCampaign(
  ctx: QueryCtx,
  { campaign }: { campaign: CampaignRow },
): Promise<Campaign> {
  const [dmUserProfile, acceptedMemberCount] = await Promise.all([
    getUserProfileById(ctx, { profileId: campaign.dmUserId }),
    countAcceptedMembers(ctx, { campaignId: campaign._id }),
  ])
  if (!dmUserProfile) throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign DM profile not found')
  const identity = await ctx.auth.getUserIdentity()
  let myMembership: CampaignMemberSummary | null = null
  if (identity) {
    const profile = await getUserProfileByAuthProfileKey(ctx, {
      authProfileKey: getAuthProfileKey(identity),
    })
    if (!profile) throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'User profile not found')
    const member: CampaignMemberRow | null = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign_user', (q) =>
        q.eq('campaignId', campaign._id).eq('userId', profile.id),
      )
      .unique()

    if (member && member.status !== CAMPAIGN_MEMBER_STATUS.Removed) {
      myMembership = toCampaignMemberSummary(member, toUserProfileSummary(profile))
    }
  }
  return {
    ...toCampaign(campaign),
    dmUserProfile: toUserProfileSummary(dmUserProfile),
    acceptedMemberCount,
    myMembership,
  }
}

// NOTE: No membership check here — callers need to verify membership
export async function getCampaign(
  ctx: AuthQueryCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<Campaign | null> {
  const campaign = await ctx.db.get('campaigns', campaignId)
  if (!campaign || campaign.status === CAMPAIGN_STATUS.Deleted) return null
  return enhanceCampaign(ctx, { campaign: toCampaignRow(campaign) })
}

// is public for the join campaign screen
export async function getCampaignBySlug(
  ctx: QueryCtx,
  { dmUsername, slug }: { dmUsername: Username; slug: CampaignSlug },
): Promise<Campaign> {
  const dmUserProfile = await getUserProfileByUsername(ctx, {
    username: dmUsername,
  })
  if (!dmUserProfile) throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign not found')
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_slug_dm', (q) => q.eq('slug', slug).eq('dmUserId', dmUserProfile.id))
    .unique()
  if (!campaign || campaign.status === CAMPAIGN_STATUS.Deleted)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign not found')
  return enhanceCampaign(ctx, { campaign: toCampaignRow(campaign) })
}
