import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { Id } from '../_generated/dataModel'
import { insertTagAndNote } from '../tags/tags'
import { createTagAndNoteArgs } from '../tags/schema'
import { endCurrentSession as endCurrentSessionHandler } from './sessions'

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
    const { tagId, noteId } = await insertTagAndNote(ctx, args)
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
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.campaignId !== args.campaignId) {
      throw new Error('Session not found')
    }

    // End existing current session if different
    const currentSessionId = (await ctx.db.get(args.campaignId))
      ?.currentSessionId
    if (currentSessionId && currentSessionId !== args.sessionId) {
      await ctx.db.patch(currentSessionId, { endedAt: Date.now() })
    }

    // Reactivate the selected session
    await ctx.db.patch(args.sessionId, { endedAt: undefined })
    await ctx.db.patch(args.campaignId, { currentSessionId: args.sessionId })
    return args.sessionId
  },
})
