import { mutationGeneric, queryGeneric } from 'convex/server'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from './campaigns/types'
import type { DatabaseReader, MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { ObjectType, PropertyValidators, Validator } from 'convex/values'
import type { AuthUser } from './users/types'
import type {
  CampaignFromDb,
  CampaignMember,
  CampaignMemberRole,
} from './campaigns/types'

// --- Context types ---

export type AuthQueryCtx = QueryCtx & { user: AuthUser }
export type AuthMutationCtx = MutationCtx & { user: AuthUser }

// --- Context enrichment ---

export async function authenticate(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthUser> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Not authenticated')
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('clerkUserId', identity.subject))
    .unique()
  if (!profile) throw new Error('No profile found')
  return { identity, profile }
}

async function checkMembership(
  ctx: AuthQueryCtx | AuthMutationCtx,
  campaignId: Id<'campaigns'>,
  options?: { allowedRoles?: ReadonlyArray<CampaignMemberRole> },
): Promise<{ campaign: CampaignFromDb; membership: CampaignMember }> {
  const campaign = await ctx.db.get(campaignId)
  if (!campaign) throw new Error('Campaign not found')
  const member = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) =>
      q.eq('campaignId', campaignId).eq('userId', ctx.user.profile._id),
    )
    .unique()
  const allowedRoles =
    options?.allowedRoles ?? Object.values(CAMPAIGN_MEMBER_ROLE)
  if (
    !member ||
    member.status !== CAMPAIGN_MEMBER_STATUS.Accepted ||
    !allowedRoles.includes(member.role)
  )
    throw new Error('Not a campaign member')
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
    throw new Error('Not a DM')
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
