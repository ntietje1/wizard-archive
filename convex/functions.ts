import { customQuery, customMutation, customCtx } from 'convex-helpers/server/customFunctions'
import { query, mutation } from './_generated/server'
import { triggers } from './triggers'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from './campaigns/types'
import { ERROR_CODE, throwClientError } from './errors'
import { getUserProfileById } from './users/functions/getUserProfile'
import type { CustomCtx } from 'convex-helpers/server/customFunctions'
import type { DatabaseReader, MutationCtx, QueryCtx } from './_generated/server'
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

async function checkMembership(
  ctx: AuthQueryCtx | AuthMutationCtx,
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

// --- Cached campaign membership helpers ---

const membershipCache = new WeakMap<
  DatabaseReader,
  Map<string, { campaign: CampaignFromDb; membership: CampaignMember }>
>()

export async function requireCampaignMembership(
  ctx: AuthQueryCtx | AuthMutationCtx,
  campaignId: Id<'campaigns'>,
): Promise<{ campaign: CampaignFromDb; membership: CampaignMember }> {
  // eslint-disable-next-line @convex-dev/explicit-table-ids
  let cache = membershipCache.get(ctx.db)
  if (!cache) {
    cache = new Map()
    membershipCache.set(ctx.db, cache)
  }
  if (!cache.has(campaignId)) {
    cache.set(campaignId, await checkMembership(ctx, campaignId))
  }
  return cache.get(campaignId)!
}

export async function requireDmRole(
  ctx: AuthQueryCtx | AuthMutationCtx,
  campaignId: Id<'campaigns'>,
): Promise<{ campaign: CampaignFromDb; membership: CampaignMember }> {
  const result = await requireCampaignMembership(ctx, campaignId)
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

// --- Context types ---

export type AuthQueryCtx = CustomCtx<typeof authQuery>
export type AuthMutationCtx = CustomCtx<typeof authMutation>
