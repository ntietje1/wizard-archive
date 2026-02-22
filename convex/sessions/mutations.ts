import { v } from 'convex/values'
import { dmMutation } from '../functions'
import { getCurrentSession, getSession } from './sessions'
import type { Doc, Id } from '../_generated/dataModel'

export const startSession = dmMutation({
  args: {
    name: v.optional(v.string()),
  },
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
    // End current session if one exists
    if (ctx.campaign.currentSessionId) {
      const existingSession = await ctx.db.get(ctx.campaign.currentSessionId)
      if (existingSession) {
        await ctx.db.patch(ctx.campaign.currentSessionId, {
          endedAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
    }

    const sessionId = await ctx.db.insert('sessions', {
      campaignId: ctx.campaign._id,
      name: args.name,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    })

    await ctx.db.patch(ctx.campaign._id, { currentSessionId: sessionId })
    return sessionId
  },
})

export const endCurrentSession = dmMutation({
  args: {},
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
    const currentSession = await getCurrentSession(ctx, ctx.campaign._id)
    if (!currentSession) {
      throw new Error('No active session')
    }

    await ctx.db.patch(currentSession._id, {
      endedAt: Date.now(),
      updatedAt: Date.now(),
    })
    await ctx.db.patch(args.campaignId, { currentSessionId: undefined })
    return currentSession._id
  },
})

export const setCurrentSession = dmMutation({
  args: {
    sessionId: v.id('sessions'),
  },
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
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

export const updateSession = dmMutation({
  args: {
    sessionId: v.id('sessions'),
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.campaignId !== args.campaignId) {
      throw new Error('Session not found')
    }

    const updates: Partial<Doc<'sessions'>> = {}
    if (args.name !== undefined) {
      updates.name = args.name
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = Date.now()
      await ctx.db.patch(args.sessionId, updates)
    }

    return null
  },
})
