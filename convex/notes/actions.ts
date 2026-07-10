'use node'

import { v } from 'convex/values'
import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { projectNoteBlocksFromYjs } from './internalActions'
import { noteProjectionResultValidator } from './projection'
import type { Id } from '../_generated/dataModel'
import type { NoteProjectionResult } from '../../shared/yjs-sync/note-projection'

export const persistNoteBlocks = action({
  args: {
    campaignId: v.id('campaigns'),
    documentId: v.id('sidebarItems'),
  },
  returns: noteProjectionResultValidator,
  handler: async (ctx, { campaignId, documentId }): Promise<NoteProjectionResult> => {
    const campaignMemberId: Id<'campaignMembers'> = await ctx.runQuery(
      internal.notes.internalQueries.requireNoteWriteAccess,
      {
        campaignId,
        documentId,
      },
    )
    return await projectNoteBlocksFromYjs(ctx, documentId, campaignMemberId)
  },
})
