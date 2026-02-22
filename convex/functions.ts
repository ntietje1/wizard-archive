import { v } from 'convex/values'
import { mutationGeneric, queryGeneric } from 'convex/server'
import { getCampaign } from './campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from './campaigns/types'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { UserIdentity } from 'convex/server'
import type { ObjectType, PropertyValidators, Validator } from 'convex/values'
import type { UserProfile } from './users/types'
import type {
  Campaign,
  CampaignMember,
  CampaignMemberRole,
} from './campaigns/types'

// --- Context types ---

type AuthUser = { identity: UserIdentity; profile: UserProfile }

export type AuthQueryCtx = QueryCtx & { user: AuthUser }
export type AuthMutationCtx = MutationCtx & { user: AuthUser }
export type CampaignQueryCtx = AuthQueryCtx & {
  campaign: Campaign
  membership: CampaignMember
}
export type CampaignMutationCtx = AuthMutationCtx & {
  campaign: Campaign
  membership: CampaignMember
}

// --- Context enrichment ---

async function authenticate(ctx: QueryCtx | MutationCtx): Promise<AuthUser> {
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
): Promise<{ campaign: Campaign; membership: CampaignMember }> {
  const campaign = await getCampaign(ctx, campaignId)
  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
    .collect()
  const allowedRoles =
    options?.allowedRoles ?? Object.values(CAMPAIGN_MEMBER_ROLE)
  const member = members.find(
    (m) =>
      m.userId === ctx.user.profile._id &&
      m.status === CAMPAIGN_MEMBER_STATUS.Accepted &&
      allowedRoles.includes(m.role),
  )
  if (!member) throw new Error('Not a campaign member')
  return {
    campaign,
    membership: { ...member, userProfile: ctx.user.profile },
  }
}

// --- Build campaign context from raw ctx (for library callbacks like prosemirrorSync) ---

export async function buildCampaignQueryCtx(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
): Promise<CampaignQueryCtx> {
  const user = await authenticate(ctx)
  const authCtx = { ...ctx, user } as AuthQueryCtx
  const { campaign, membership } = await checkMembership(authCtx, campaignId)
  return { ...authCtx, campaign, membership }
}

export async function buildCampaignMutationCtx(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
): Promise<CampaignMutationCtx> {
  const user = await authenticate(ctx)
  const authCtx = { ...ctx, user } as AuthMutationCtx
  const { campaign, membership } = await checkMembership(authCtx, campaignId)
  return { ...authCtx, campaign, membership }
}

// --- Config types --- TODO: potentially make args and returns required

type AuthConfig<TArgs extends PropertyValidators, TReturn> = {
  args?: TArgs
  returns?: Validator<unknown, 'required', string>
  handler: (ctx: AuthQueryCtx, args: ObjectType<TArgs>) => Promise<TReturn>
}

type AuthMutationConfig<TArgs extends PropertyValidators, TReturn> = {
  args?: TArgs
  returns?: Validator<unknown, 'required', string>
  handler: (ctx: AuthMutationCtx, args: ObjectType<TArgs>) => Promise<TReturn>
}

type CampaignConfig<TCtx, TArgs extends PropertyValidators, TReturn> = {
  args?: TArgs
  returns?: Validator<unknown, 'required', string>
  handler: (
    ctx: TCtx,
    args: ObjectType<TArgs> & { campaignId: Id<'campaigns'> },
  ) => Promise<TReturn>
}

// --- Wrappers ---

export function authQuery<TArgs extends PropertyValidators, TReturn>(
  config: AuthConfig<TArgs, TReturn>,
) {
  return queryGeneric({
    ...(config.args ? { args: config.args } : {}),
    ...(config.returns ? { returns: config.returns } : {}),
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
    ...(config.args ? { args: config.args } : {}),
    ...(config.returns ? { returns: config.returns } : {}),
    handler: async (ctx: MutationCtx, args: ObjectType<TArgs>) => {
      const user = await authenticate(ctx)
      return config.handler({ ...ctx, user }, args)
    },
  })
}

export function campaignQuery<TArgs extends PropertyValidators, TReturn>(
  config: CampaignConfig<CampaignQueryCtx, TArgs, TReturn>,
) {
  return queryGeneric({
    args: { ...config.args, campaignId: v.id('campaigns') },
    ...(config.returns ? { returns: config.returns } : {}),
    handler: async (
      ctx: QueryCtx,
      args: ObjectType<TArgs> & { campaignId: Id<'campaigns'> },
    ) => {
      const user = await authenticate(ctx)
      const authCtx = { ...ctx, user } as AuthQueryCtx
      const { campaign, membership } = await checkMembership(
        authCtx,
        args.campaignId,
      )
      return config.handler({ ...authCtx, campaign, membership }, args)
    },
  })
}

export function campaignMutation<TArgs extends PropertyValidators, TReturn>(
  config: CampaignConfig<CampaignMutationCtx, TArgs, TReturn>,
) {
  return mutationGeneric({
    args: { ...config.args, campaignId: v.id('campaigns') },
    ...(config.returns ? { returns: config.returns } : {}),
    handler: async (
      ctx: MutationCtx,
      args: ObjectType<TArgs> & { campaignId: Id<'campaigns'> },
    ) => {
      const user = await authenticate(ctx)
      const authCtx = { ...ctx, user } as AuthMutationCtx
      const { campaign, membership } = await checkMembership(
        authCtx,
        args.campaignId,
      )
      return config.handler({ ...authCtx, campaign, membership }, args)
    },
  })
}

export function dmQuery<TArgs extends PropertyValidators, TReturn>(
  config: CampaignConfig<CampaignQueryCtx, TArgs, TReturn>,
) {
  return queryGeneric({
    args: { ...config.args, campaignId: v.id('campaigns') },
    ...(config.returns ? { returns: config.returns } : {}),
    handler: async (
      ctx: QueryCtx,
      args: ObjectType<TArgs> & { campaignId: Id<'campaigns'> },
    ) => {
      const user = await authenticate(ctx)
      const authCtx = { ...ctx, user } as AuthQueryCtx
      const { campaign, membership } = await checkMembership(
        authCtx,
        args.campaignId,
        { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
      )
      return config.handler({ ...authCtx, campaign, membership }, args)
    },
  })
}

export function dmMutation<TArgs extends PropertyValidators, TReturn>(
  config: CampaignConfig<CampaignMutationCtx, TArgs, TReturn>,
) {
  return mutationGeneric({
    args: { ...config.args, campaignId: v.id('campaigns') },
    ...(config.returns ? { returns: config.returns } : {}),
    handler: async (
      ctx: MutationCtx,
      args: ObjectType<TArgs> & { campaignId: Id<'campaigns'> },
    ) => {
      const user = await authenticate(ctx)
      const authCtx = { ...ctx, user } as AuthMutationCtx
      const { campaign, membership } = await checkMembership(
        authCtx,
        args.campaignId,
        { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
      )
      return config.handler({ ...authCtx, campaign, membership }, args)
    },
  })
}
