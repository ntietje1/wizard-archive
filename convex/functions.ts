import { v } from 'convex/values'
import { mutationGeneric, queryGeneric } from 'convex/server'
import { getCampaign } from './campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from './campaigns/types'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { ObjectType, PropertyValidators, Validator } from 'convex/values'
import type { AuthUser } from './users/types'
import type {
  Campaign,
  CampaignMember,
  CampaignMemberRole,
} from './campaigns/types'
import type { SidebarItemId } from './sidebarItems/baseTypes'

// --- Context types ---

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

// --- Config types ---

type WithCampaignId = {
  campaignId: Validator<Id<'campaigns'>, 'required', string>
}

type WithSidebarItemId = WithCampaignId & {
  sidebarItemId: Validator<SidebarItemId, 'required', string>
}

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

type CampaignConfig<
  TCtx,
  TArgs extends PropertyValidators & WithCampaignId,
  TReturn,
> = {
  args: TArgs
  returns: Validator<unknown, 'required', string>
  handler: (ctx: TCtx, args: ObjectType<TArgs>) => Promise<TReturn>
}

type SidebarConfig<
  TCtx,
  TArgs extends PropertyValidators & WithSidebarItemId,
  TReturn,
> = {
  args: TArgs
  returns: Validator<unknown, 'required', string>
  handler: (ctx: TCtx, args: ObjectType<TArgs>) => Promise<TReturn>
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

export function campaignQuery<
  TArgs extends PropertyValidators & WithCampaignId,
  TReturn,
>(config: CampaignConfig<CampaignQueryCtx, TArgs, TReturn>) {
  return queryGeneric({
    args: config.args,
    returns: config.returns,
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

export function campaignMutation<
  TArgs extends PropertyValidators & WithCampaignId,
  TReturn,
>(config: CampaignConfig<CampaignMutationCtx, TArgs, TReturn>) {
  return mutationGeneric({
    args: config.args,
    returns: config.returns,
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

export function dmQuery<
  TArgs extends PropertyValidators & WithCampaignId,
  TReturn,
>(config: CampaignConfig<CampaignQueryCtx, TArgs, TReturn>) {
  return queryGeneric({
    args: config.args,
    returns: config.returns,
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

export function dmMutation<
  TArgs extends PropertyValidators & WithCampaignId,
  TReturn,
>(config: CampaignConfig<CampaignMutationCtx, TArgs, TReturn>) {
  return mutationGeneric({
    args: config.args,
    returns: config.returns,
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

export function sidebarQuery<
  TArgs extends PropertyValidators & WithSidebarItemId,
  TReturn,
>(config: SidebarConfig<CampaignQueryCtx, TArgs, TReturn>) {
  return queryGeneric({
    args: config.args,
    returns: config.returns,
    handler: async (
      ctx: QueryCtx,
      args: ObjectType<TArgs> & {
        campaignId: Id<'campaigns'>
        sidebarItemId: SidebarItemId
      },
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

export function sidebarMutation<
  TArgs extends PropertyValidators & WithSidebarItemId,
  TReturn,
>(config: SidebarConfig<CampaignMutationCtx, TArgs, TReturn>) {
  return mutationGeneric({
    args: config.args,
    returns: config.returns,
    handler: async (
      ctx: MutationCtx,
      args: ObjectType<TArgs> & {
        campaignId: Id<'campaigns'>
        sidebarItemId: SidebarItemId
      },
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
