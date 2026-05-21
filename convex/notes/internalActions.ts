'use node'

import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { yjsUpdatesToBlocks } from './blocknoteNode'
import type { ActionCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

export async function projectNoteBlocksFromYjs(
  ctx: Pick<ActionCtx, 'runQuery' | 'runMutation'>,
  documentId: Id<'sidebarItems'>,
): Promise<void> {
  const updates = await ctx.runQuery(internal.yjsSync.internalQueries.listUpdatesForDocument, {
    documentId,
  })
  await ctx.runMutation(internal.notes.internalMutations.syncDerivedDataFromBlocks, {
    noteId: documentId,
    content: yjsUpdatesToBlocks(updates),
  })
}

export const persistNoteBlocksFromYjs = internalAction({
  args: {
    documentId: v.id('sidebarItems'),
  },
  returns: v.null(),
  handler: async (ctx, { documentId }) => {
    await projectNoteBlocksFromYjs(ctx, documentId)
    return null
  },
})
