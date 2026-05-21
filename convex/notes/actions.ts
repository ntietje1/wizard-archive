'use node'

import { v } from 'convex/values'
import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { projectNoteBlocksFromYjs } from './internalActions'

export const persistNoteBlocks = action({
  args: {
    campaignId: v.id('campaigns'),
    documentId: v.id('sidebarItems'),
  },
  returns: v.null(),
  handler: async (ctx, { campaignId, documentId }) => {
    await ctx.runQuery(internal.notes.internalQueries.requireNoteWriteAccess, {
      campaignId,
      documentId,
    })
    await projectNoteBlocksFromYjs(ctx, documentId)
    return null
  },
})
