import { mutationGeneric, queryGeneric } from 'convex/server'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from './campaigns/types'
import { ERROR_CODE, throwClientError } from './errors'
import type { DatabaseReader, MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { ObjectType, PropertyValidators, Validator } from 'convex/values'
import type { AuthUser } from './users/types'
import type { CampaignFromDb, CampaignMember } from './campaigns/types'

// --- Context types ---

export type AuthQueryCtx = QueryCtx & { user: AuthUser }
export type AuthMutationCtx = MutationCtx & { user: AuthUser }

// --- Context enrichment ---

export async function authenticate(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthUser> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity)
    throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'Not authenticated')
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('authUserId', identity.subject))
    .unique()
  if (!profile)
    throwClientError(ERROR_CODE.NOT_AUTHENTICATED, 'No profile found')
  return { identity, profile }
}

async function checkMembership(
  ctx: AuthQueryCtx | AuthMutationCtx,
  campaignId: Id<'campaigns'>,
): Promise<{ campaign: CampaignFromDb; membership: CampaignMember }> {
  const campaign = await ctx.db.get(campaignId)
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
    throwClientError(
      ERROR_CODE.PERMISSION_DENIED,
      "You don't have access to this campaign",
    )
  return {
    campaign,
    membership: { ...member, userProfile: ctx.user.profile },
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
    throwClientError(
      ERROR_CODE.PERMISSION_DENIED,
      'Only the DM can perform this action',
    )
  }
  return result
}

// --- Config types ---

type AuthConfig<TArgs extends PropertyValidators, TReturn> = {
  args: TArgs
  returns: Validator<unknown, 'required', string>
  handler: (ctx: AuthQueryCtx, args: ObjectType<TArgs>) => Promise<TReturn>
}

type AuthMutationConfig<TArgs extends PropertyValidators, TReturn> = {
  args: TArgs
  returns: Validator<unknown, 'required', string>
  handler: (ctx: AuthMutationCtx, args: ObjectType<TArgs>) => Promise<TReturn>
}

// --- Wrappers ---

export function authQuery<TArgs extends PropertyValidators, TReturn>(
  config: AuthConfig<TArgs, TReturn>,
) {
  return queryGeneric({
    args: config.args,
    returns: config.returns,
    handler: async (ctx: QueryCtx, args: ObjectType<TArgs>) => {
      const user = await authenticate(ctx)
      return config.handler({ ...ctx, user }, args)
    },
  })
}

export function authMutation<TArgs extends PropertyValidators, TReturn>(
  config: AuthMutationConfig<TArgs, TReturn>,
) {
  return mutationGeneric({
    args: config.args,
    returns: config.returns,
    handler: async (ctx: MutationCtx, args: ObjectType<TArgs>) => {
      const user = await authenticate(ctx)
      return config.handler({ ...ctx, user }, args)
    },
  })
}
