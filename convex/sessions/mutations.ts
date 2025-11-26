import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { Id } from '../_generated/dataModel'
import { insertTagAndNote } from '../tags/tags'
import { createTagAndNoteArgs } from '../tags/schema'
import {
  endCurrentSession as endCurrentSessionHandler,
  getCurrentSession,
  getSession,
} from './sessions'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'

export const startSession = mutation({
  args: {
    ...createTagAndNoteArgs,
    endedAt: v.optional(v.number()),
  },
  returns: v.object({
    tagId: v.id('tags'),
    noteId: v.id('notes'),
    sessionId: v.id('sessions'),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    tagId: Id<'tags'>
    noteId: Id<'notes'>
    sessionId: Id<'sessions'>
  }> => {
    const { campaignWithMembership } = await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
    const { campaign } = campaignWithMembership

    if (campaign.currentSessionId) {
      await ctx.db.patch(campaign.currentSessionId, { endedAt: Date.now() })
    }

    const { tagId, noteId } = await insertTagAndNote(
      ctx,
      args,
      args.parentFolderId,
    )
    const sessionId = await ctx.db.insert('sessions', {
      campaignId: args.campaignId,
      tagId: tagId,
      endedAt: args.endedAt,
    })
    await ctx.db.patch(args.campaignId, { currentSessionId: sessionId })
    return { tagId, noteId, sessionId }
  },
})

export const endCurrentSession = mutation({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
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
    const newSession = await getSession(ctx, args.sessionId)
    if (!newSession || newSession.campaignId !== args.campaignId) {
      throw new Error('Session not found')
    }
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const currentSession = await getCurrentSession(ctx, args.campaignId)
    if (currentSession && currentSession.sessionId !== args.sessionId) {
      await ctx.db.patch(currentSession.sessionId, { endedAt: Date.now() })
    }

    await ctx.db.patch(args.sessionId, { endedAt: undefined })
    await ctx.db.patch(args.campaignId, { currentSessionId: args.sessionId })
    return args.sessionId
  },
})
