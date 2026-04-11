import { customQuery, customMutation, customCtx } from 'convex-helpers/server/customFunctions'
import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { triggers } from './triggers'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from './campaigns/types'
import { ERROR_CODE, throwClientError } from './errors'
import { getUserProfileById } from './users/functions/getUserProfile'
import type { CustomCtx } from 'convex-helpers/server/customFunctions'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { AuthUser } from './users/types'
import type { CampaignFromDb, CampaignMember } from './campaigns/types'

// --- Context enrichment ---

export async function authenticate(ctx: QueryCtx | MutationCtx): Promise<AuthUser> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'Not authenticated')
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('authUserId', identity.subject))
    .unique()
  if (!profile) throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'No profile found')
  return { identity, profile }
}

// convex-helpers does not propagate enriched ctx types through chained
// customQuery/customMutation, so input callbacks receive GenericQueryCtx /
// GenericMutationCtx. This assertion narrows to the actual runtime shape
// after authQuery/authMutation have run.
type AuthenticatedCtx = QueryCtx & { user: AuthUser }

function assertAuthenticatedCtx(ctx: Record<string, any>): asserts ctx is AuthenticatedCtx {
  if (!('user' in ctx)) {
    throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'Missing authentication context')
  }
}

async function checkMembership(
  ctx: AuthenticatedCtx,
  campaignId: Id<'campaigns'>,
): Promise<{ campaign: CampaignFromDb; membership: CampaignMember }> {
  const campaign = await ctx.db.get('campaigns', campaignId)
  const member = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) =>
      q.eq('campaignId', campaignId).eq('userId', ctx.user.profile._id),
    )
    .unique()
  if (
    !campaign ||
    campaign.deletionTime !== null ||
    !member ||
    member.deletionTime !== null ||
    member.status !== CAMPAIGN_MEMBER_STATUS.Accepted
  )
    throwClientError(ERROR_CODE.PERMISSION_DENIED, "You don't have access to this campaign")
  const userProfile = await getUserProfileById(ctx, {
    profileId: ctx.user.profile._id,
  })
  if (!userProfile) throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'No profile found')
  return {
    campaign,
    membership: { ...member, userProfile },
  }
}

async function checkDmMembership(
  ctx: AuthenticatedCtx,
  campaignId: Id<'campaigns'>,
): Promise<{ campaign: CampaignFromDb; membership: CampaignMember }> {
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

const campaignArgs = { campaignId: v.id('campaigns') } as const

export const campaignQuery = customQuery(authQuery, {
  args: campaignArgs,
  input: async (ctx, { campaignId }) => {
    assertAuthenticatedCtx(ctx)
    const { campaign, membership } = await checkMembership(ctx, campaignId)
    return { ctx: { campaign, membership }, args: {} }
  },
})

export const campaignMutation = customMutation(authMutation, {
  args: campaignArgs,
  input: async (ctx, { campaignId }) => {
    assertAuthenticatedCtx(ctx)
    const { campaign, membership } = await checkMembership(ctx, campaignId)
    return { ctx: { campaign, membership }, args: {} }
  },
})

export const dmQuery = customQuery(authQuery, {
  args: campaignArgs,
  input: async (ctx, { campaignId }) => {
    assertAuthenticatedCtx(ctx)
    const { campaign, membership } = await checkDmMembership(ctx, campaignId)
    return { ctx: { campaign, membership }, args: {} }
  },
})

export const dmMutation = customMutation(authMutation, {
  args: campaignArgs,
  input: async (ctx, { campaignId }) => {
    assertAuthenticatedCtx(ctx)
    const { campaign, membership } = await checkDmMembership(ctx, campaignId)
    return { ctx: { campaign, membership }, args: {} }
  },
})

// --- Context types ---

export type AuthQueryCtx = CustomCtx<typeof authQuery>
export type AuthMutationCtx = CustomCtx<typeof authMutation>
export type CampaignQueryCtx = CustomCtx<typeof campaignQuery>
export type CampaignMutationCtx = CustomCtx<typeof campaignMutation>
export type DmQueryCtx = CustomCtx<typeof dmQuery>
export type DmMutationCtx = CustomCtx<typeof dmMutation>
