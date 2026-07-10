'use node'

import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { yjsUpdatesToBlocks } from './blocknoteNode'
import type { ActionCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { logger } from '../common/logger'
import { NOTE_PROJECTION_REJECTION_REASON } from '../../shared/yjs-sync/note-projection'
import { noteProjectionResultValidator } from './projection'
import type { NoteProjectionResult } from '../../shared/yjs-sync/note-projection'

export async function projectNoteBlocksFromYjs(
  ctx: Pick<ActionCtx, 'runQuery' | 'runMutation'>,
  documentId: Id<'sidebarItems'>,
  campaignMemberId?: Id<'campaignMembers'>,
): Promise<NoteProjectionResult> {
  const updates = await ctx.runQuery(internal.yjsSync.internalQueries.listUpdatesForDocument, {
    documentId,
  })
  let content
  try {
    content = yjsUpdatesToBlocks(updates)
  } catch (error) {
    logger.error(`Note projection rejected invalid Yjs document ${documentId}`, error)
    return { status: 'rejected', reason: NOTE_PROJECTION_REJECTION_REASON.invalidDocument }
  }
  await ctx.runMutation(internal.notes.internalMutations.syncDerivedDataFromBlocks, {
    noteId: documentId,
    content,
    campaignMemberId,
  })
  return { status: 'projected', throughSeq: updates[updates.length - 1]?.seq ?? -1 }
}

export const persistNoteBlocksFromYjs = internalAction({
  args: {
    documentId: v.id('sidebarItems'),
    campaignMemberId: v.optional(v.id('campaignMembers')),
  },
  returns: noteProjectionResultValidator,
  handler: async (ctx, { campaignMemberId, documentId }) =>
    await projectNoteBlocksFromYjs(ctx, documentId, campaignMemberId),
})
