import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
  SessionId,
} from '@wizard-archive/editor/resources/domain-id'
import type { ResourceShare } from '@wizard-archive/editor/resources/resource-contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'

export type SidebarItemShareIdentityProjection = Readonly<{
  campaignRowId: Id<'campaigns'>
  campaignId: CampaignId
  memberIds: ReadonlyMap<Id<'campaignMembers'>, CampaignMemberId>
  sessionIds: ReadonlyMap<Id<'sessions'>, SessionId>
}>

export function createSidebarItemShareIdentityProjection(
  campaign: Doc<'campaigns'>,
  members: ReadonlyArray<Doc<'campaignMembers'>>,
  sessions: ReadonlyArray<Doc<'sessions'>>,
): SidebarItemShareIdentityProjection {
  for (const member of members) {
    if (member.campaignId !== campaign._id) {
      throw new Error('Campaign member identity belongs to another campaign')
    }
  }
  for (const session of sessions) {
    if (session.campaignId !== campaign._id) {
      throw new Error('Session identity belongs to another campaign')
    }
  }

  return {
    campaignRowId: campaign._id,
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, campaign.campaignUuid),
    memberIds: new Map(
      members.map((member) => [
        member._id,
        assertDomainId(DOMAIN_ID_KIND.campaignMember, member.campaignMemberUuid),
      ]),
    ),
    sessionIds: new Map(
      sessions.map((session) => [
        session._id,
        assertDomainId(DOMAIN_ID_KIND.session, session.sessionUuid),
      ]),
    ),
  }
}

export async function loadSidebarItemShareIdentityProjection(ctx: CampaignQueryCtx) {
  const [members, sessions] = await Promise.all([
    ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign_user', (query) => query.eq('campaignId', ctx.campaign._id))
      .collect(),
    ctx.db
      .query('sessions')
      .withIndex('by_campaign_startedAt', (query) => query.eq('campaignId', ctx.campaign._id))
      .collect(),
  ])
  return {
    identities: createSidebarItemShareIdentityProjection(ctx.campaign, members, sessions),
    members,
  }
}

export function projectSidebarItemShare(
  share: Doc<'sidebarItemShares'>,
  identities: SidebarItemShareIdentityProjection,
  resourceId: ResourceId,
): ResourceShare {
  if (share.campaignId !== identities.campaignRowId) {
    throw new Error('Resource share belongs to another campaign')
  }
  const campaignMemberId = identities.memberIds.get(share.campaignMemberId)
  if (!campaignMemberId) throw new Error('Resource share member is missing from its campaign')
  const sessionId = share.sessionId === null ? null : identities.sessionIds.get(share.sessionId)
  if (sessionId === undefined)
    throw new Error('Resource share session is missing from its campaign')

  return {
    id: share.resourceShareUuid,
    createdAt: share._creationTime,
    campaignId: identities.campaignId,
    sidebarItemId: resourceId,
    sidebarItemType: share.sidebarItemType,
    campaignMemberId,
    sessionId,
    permissionLevel: share.permissionLevel,
  }
}
