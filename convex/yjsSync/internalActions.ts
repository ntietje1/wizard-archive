'use node'

import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { snapshotTypeValidator } from '../documentSnapshots/schema'
import { sidebarItemTypeValidator } from '../sidebarItems/schema/validators'
import { yjsDocumentIdValidator } from './schema'
import { compactYjsUpdates, encodeYjsSnapshot } from './_yjsNode'

export const compact = internalAction({
  args: {
    documentId: yjsDocumentIdValidator,
  },
  returns: v.null(),
  handler: async (ctx, { documentId }) => {
    const updates = await ctx.runQuery(internal.yjsSync.internalQueries.listUpdatesForDocument, {
      documentId,
    })
    const compacted = compactYjsUpdates(updates)
    if (!compacted) return null

    await ctx.runMutation(internal.yjsSync.internalMutations.replaceWithSnapshotUpdate, {
      documentId,
      updateIds: updates.map((update) => update._id),
      update: compacted.update,
      seq: compacted.seq,
    })
    return null
  },
})

export const captureSnapshot = internalAction({
  args: {
    documentId: yjsDocumentIdValidator,
    itemType: sidebarItemTypeValidator,
    snapshotType: snapshotTypeValidator,
    editHistoryId: v.id('editHistory'),
    campaignId: v.id('campaigns'),
    maxSeq: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates = await ctx.runQuery(
      internal.yjsSync.internalQueries.listUpdatesForDocumentThroughSeq,
      {
        documentId: args.documentId,
        maxSeq: args.maxSeq,
      },
    )
    const data = encodeYjsSnapshot(updates)

    await ctx.runMutation(internal.yjsSync.internalMutations.createSnapshotFromYjsState, {
      itemId: args.documentId,
      itemType: args.itemType,
      snapshotType: args.snapshotType,
      editHistoryId: args.editHistoryId,
      campaignId: args.campaignId,
      data,
    })
    return null
  },
})
