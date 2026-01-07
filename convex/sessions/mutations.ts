import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import {
  endCurrentSession as endCurrentSessionHandler,
  getCurrentSession,
  getSession,
  startSession as startSessionHandler,
} from './sessions'
import type { Doc, Id } from '../_generated/dataModel'

export const startSession = mutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.optional(v.string()),
  },
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
    return await startSessionHandler(ctx, args.campaignId, args.name)
  },
})

export const endCurrentSession = mutation({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
    return await endCurrentSessionHandler(ctx, args.campaignId)
  },
})

export const setCurrentSession = mutation({
  args: {
    campaignId: v.id('campaigns'),
    sessionId: v.id('sessions'),
  },
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const newSession = await getSession(ctx, args.sessionId)
    if (!newSession || newSession.campaignId !== args.campaignId) {
      throw new Error('Session not found')
    }

    const currentSession = await getCurrentSession(ctx, args.campaignId)
    if (currentSession && currentSession._id !== args.sessionId) {
      await ctx.db.patch(currentSession._id, { endedAt: Date.now() })
    }

    await ctx.db.patch(args.sessionId, { endedAt: undefined })
    await ctx.db.patch(args.campaignId, { currentSessionId: args.sessionId })
    return args.sessionId
  },
})

export const updateSession = mutation({
  args: {
    sessionId: v.id('sessions'),
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: session.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const updates: Partial<Doc<'sessions'>> = {
      updatedAt: Date.now(),
    }
    if (args.name !== undefined) {
      updates.name = args.name
    }

    if (Object.keys(updates).length > 1) {
      await ctx.db.patch(args.sessionId, updates)
    }

    return null
  },
})
