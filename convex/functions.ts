import { customQuery, customMutation, customCtx } from 'convex-helpers/server/customFunctions'
import { v } from 'convex/values'
import { query, mutation, internalMutation, internalQuery } from './_generated/server'
import { triggers } from './triggers'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from '../shared/campaigns/types'
import { assertCampaignSlug } from './campaigns/validation'
import { ERROR_CODE } from '../shared/errors/client'
import { throwClientError } from './errors'
import { getAuthProfileKey } from './auth/identity'
import { assertStoredUsername } from './users/validation'
import { getUserProfileDocByAuthProfileKey } from './users/functions/getUserProfile'
import type { CustomCtx } from 'convex-helpers/server/customFunctions'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { AuthUser } from './users/authTypes'
import type { CampaignRow, CampaignMemberRow } from '../shared/campaigns/types'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId as DomainCampaignId,
  CampaignMemberId as DomainCampaignMemberId,
} from '@wizard-archive/editor/resources/domain-id'
import { getAssetIdByStorageId } from './storage/functions/assetIdentity'
import { findCampaignRow } from './campaigns/functions/campaignIdentity'

// --- Context enrichment ---

async function toAuthenticatedProfile(
  ctx: QueryCtx | MutationCtx,
  profile: Doc<'userProfiles'>,
): Promise<AuthUser['profile']> {
  let profileImage: AuthUser['profile']['profileImage']
  if (profile.profileImage?.type === 'storage') {
    const assetId = await getAssetIdByStorageId(ctx.db, profile.profileImage.storageId)
    if (assetId === null) throw new Error('Profile image is missing its asset identity')
    profileImage = { type: 'asset', assetId }
  } else {
    profileImage = profile.profileImage
  }
  return {
    ...profile,
    profileImage,
    username: assertStoredUsername(profile.username),
  }
}

function toCampaignRow(campaign: Doc<'campaigns'>): CampaignRow {
  return {
    ...campaign,
    slug: assertCampaignSlug(campaign.slug),
    defaultFolderInheritShares: campaign.defaultFolderInheritShares ?? false,
  }
}

export async function authenticate(ctx: QueryCtx | MutationCtx): Promise<AuthUser> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'Not authenticated')
  const authProfileKey = getAuthProfileKey(identity)
  const profile = await getUserProfileDocByAuthProfileKey(ctx, { authProfileKey })
  if (!profile) throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'No profile found')
  return { identity, profile: await toAuthenticatedProfile(ctx, profile) }
}

// convex-helpers does not propagate enriched ctx types through chained
// customQuery/customMutation, so input callbacks receive GenericQueryCtx /
// GenericMutationCtx. This assertion narrows to the actual runtime shape
// after authQuery/authMutation have run.
type AuthenticatedCtx = (QueryCtx | MutationCtx) & { user: AuthUser }

function assertAuthenticatedCtx(ctx: object): asserts ctx is AuthenticatedCtx {
  if (!('user' in ctx)) {
    throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'Missing authentication context')
  }
}

async function checkMembership(
  ctx: AuthenticatedCtx,
  campaignId: Id<'campaigns'>,
): Promise<{ campaign: CampaignRow; membership: CampaignMemberRow }> {
  const campaign = await ctx.db.get('campaigns', campaignId)
  const member = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) =>
      q.eq('campaignId', campaignId).eq('userId', ctx.user.profile._id),
    )
    .unique()
  if (
    !campaign ||
    campaign.status === CAMPAIGN_STATUS.Deleted ||
    !member ||
    member.status !== CAMPAIGN_MEMBER_STATUS.Accepted
  )
    throwClientError(ERROR_CODE.PERMISSION_DENIED, "You don't have access to this campaign")
  return {
    campaign: toCampaignRow(campaign),
    membership: member,
  }
}

export async function checkDmMembership(
  ctx: AuthenticatedCtx,
  campaignId: Id<'campaigns'>,
): Promise<{ campaign: CampaignRow; membership: CampaignMemberRow }> {
  const result = await checkMembership(ctx, campaignId)
  if (result.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can perform this action')
  }
  return result
}

// --- Wrappers ---

export const authQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const user = await authenticate(ctx)
    return { user }
  }),
)

export const authMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const user = await authenticate(ctx)
    return { ...triggers.wrapDB(ctx), user }
  }),
)

// --- Campaign-scoped wrappers ---

const campaignArgs = { campaignId: v.string() } as const
const campaignRowArgs = { campaignId: v.id('campaigns') } as const
type CampaignScopeInputArgs = { campaignId: string }
type CampaignScopeInputResult = {
  ctx: {
    campaign: CampaignRow
    membership: CampaignMemberRow
    resourceScope: {
      campaignId: DomainCampaignId
      actorId: DomainCampaignMemberId
    }
  }
  args: {}
}

async function campaignScopeInput(
  ctx: object,
  { campaignId: campaignIdValue }: CampaignScopeInputArgs,
): Promise<CampaignScopeInputResult> {
  assertAuthenticatedCtx(ctx)
  const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, campaignIdValue)
  const campaignDoc = await findCampaignRow(ctx, campaignId)
  if (!campaignDoc) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, "You don't have access to this campaign")
  }
  const { campaign, membership } = await checkMembership(ctx, campaignDoc._id)
  const actorId = assertDomainId(DOMAIN_ID_KIND.campaignMember, membership.campaignMemberUuid)
  return { ctx: { campaign, membership, resourceScope: { campaignId, actorId } }, args: {} }
}

async function dmScopeInput(
  ctx: object,
  input: CampaignScopeInputArgs,
): Promise<CampaignScopeInputResult> {
  const scoped = await campaignScopeInput(ctx, input)
  if (scoped.ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can perform this action')
  }
  return scoped
}

async function campaignRowScopeInput(
  ctx: object,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<CampaignScopeInputResult> {
  assertAuthenticatedCtx(ctx)
  const { campaign, membership } = await checkMembership(ctx, campaignId)
  return {
    ctx: {
      campaign,
      membership,
      resourceScope: {
        campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, campaign.campaignUuid),
        actorId: assertDomainId(DOMAIN_ID_KIND.campaignMember, membership.campaignMemberUuid),
      },
    },
    args: {},
  }
}

async function dmRowScopeInput(ctx: object, input: { campaignId: Id<'campaigns'> }) {
  const scoped = await campaignRowScopeInput(ctx, input)
  if (scoped.ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can perform this action')
  }
  return scoped
}

export const campaignQuery = customQuery(authQuery, {
  args: campaignArgs,
  input: campaignScopeInput,
})

const authInternalQuery = customQuery(
  internalQuery,
  customCtx(async (ctx) => {
    const user = await authenticate(ctx)
    return { user }
  }),
)

const authInternalMutation = customMutation(
  internalMutation,
  customCtx(async (ctx) => {
    const user = await authenticate(ctx)
    return { ...triggers.wrapDB(ctx), user }
  }),
)

export const campaignInternalQuery = customQuery(authInternalQuery, {
  args: campaignRowArgs,
  input: campaignRowScopeInput,
})

export const campaignInternalMutation = customMutation(authInternalMutation, {
  args: campaignRowArgs,
  input: campaignRowScopeInput,
})

export const dmInternalQuery = customQuery(authInternalQuery, {
  args: campaignRowArgs,
  input: dmRowScopeInput,
})

export const campaignMutation = customMutation(authMutation, {
  args: campaignArgs,
  input: campaignScopeInput,
})

export const dmQuery = customQuery(authQuery, {
  args: campaignArgs,
  input: dmScopeInput,
})

export const dmMutation = customMutation(authMutation, {
  args: campaignArgs,
  input: dmScopeInput,
})

// --- Context types ---

export type AuthQueryCtx = CustomCtx<typeof authQuery>
export type AuthMutationCtx = CustomCtx<typeof authMutation>
export type CampaignQueryCtx = CustomCtx<typeof campaignQuery>
export type CampaignMutationCtx = CustomCtx<typeof campaignMutation>
export type CampaignInternalQueryCtx = CustomCtx<typeof campaignInternalQuery>
export type CampaignInternalMutationCtx = CustomCtx<typeof campaignInternalMutation>
export type DmQueryCtx = CustomCtx<typeof dmQuery>
export type DmMutationCtx = CustomCtx<typeof dmMutation>
export type DmInternalQueryCtx = CustomCtx<typeof dmInternalQuery>
