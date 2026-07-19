import { getAuthProfileKey } from '../../auth/identity'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_STATUS, CAMPAIGN_STATUS } from '../../../shared/campaigns/types'
import {
  getUserProfileDocByAuthProfileKey,
  getUserProfileById,
} from '../../users/functions/getUserProfile'
import { toUserProfileSummary } from '../../users/functions/profileSummary'
import type { Campaign, CampaignMemberSummary } from '../../../shared/campaigns/types'
import type { CampaignMemberRow, CampaignRow } from '../rows'
import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { toCampaignMemberProjection } from './campaignMemberProjection'

function toCampaign(campaign: CampaignRow): Omit<Campaign, 'dmUserProfile' | 'myMembership'> {
  const {
    _id: _rowId,
    _creationTime,
    campaignUuid,
    currentSessionId: _currentSessionId,
    dmUserId: _dmUserRowId,
    ...fields
  } = campaign
  return {
    ...fields,
    id: assertDomainId(DOMAIN_ID_KIND.campaign, campaignUuid),
    createdAt: _creationTime,
  }
}

async function enhanceCampaign(
  ctx: QueryCtx,
  { campaign }: { campaign: CampaignRow },
): Promise<Campaign> {
  const dmUserProfile = await getUserProfileById(ctx, { profileId: campaign.dmUserId })
  if (!dmUserProfile) throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign DM profile not found')
  const identity = await ctx.auth.getUserIdentity()
  let myMembership: CampaignMemberSummary | null = null
  if (identity) {
    const profileRow = await getUserProfileDocByAuthProfileKey(ctx, {
      authProfileKey: getAuthProfileKey(identity),
    })
    if (!profileRow) throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'User profile not found')
    const member: CampaignMemberRow | null = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign_user', (q) =>
        q.eq('campaignId', campaign._id).eq('userId', profileRow._id),
      )
      .unique()

    if (member && member.status !== CAMPAIGN_MEMBER_STATUS.Removed) {
      const profile = await getUserProfileById(ctx, { profileId: profileRow._id })
      if (!profile) throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'User profile not found')
      myMembership = toCampaignMemberProjection(
        member,
        assertDomainId(DOMAIN_ID_KIND.campaign, campaign.campaignUuid),
        profile.id,
        toUserProfileSummary(profile),
      )
    }
  }
  return {
    ...toCampaign(campaign),
    dmUserProfile: toUserProfileSummary(dmUserProfile),
    myMembership,
  }
}

// NOTE: No membership check here — callers need to verify membership
export async function getCampaign(
  ctx: QueryCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<Campaign | null> {
  const campaign = await ctx.db.get('campaigns', campaignId)
  if (!campaign || campaign.status === CAMPAIGN_STATUS.Deleted) return null
  return enhanceCampaign(ctx, { campaign })
}

export async function getCampaignInvitation(
  ctx: QueryCtx,
  campaignId: Campaign['id'],
): Promise<Campaign> {
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
    .unique()
  if (!campaign || campaign.status === CAMPAIGN_STATUS.Deleted)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign not found')
  return enhanceCampaign(ctx, { campaign })
}
