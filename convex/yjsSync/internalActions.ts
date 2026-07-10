'use node'

import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { internalAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { yjsDocumentIdValidator } from './schema'
import { compactYjsUpdates, encodeYjsSnapshot } from './_yjsNode'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { snapshotCaptureResultValidator } from './snapshotCapture'
import type { SnapshotCaptureResult } from './snapshotCapture'

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
    itemType: literals(RESOURCE_TYPES.notes, RESOURCE_TYPES.canvases),
    editHistoryId: v.id('editHistory'),
    campaignId: v.id('campaigns'),
    expectedRevision: v.number(),
    maxSeq: v.number(),
  },
  returns: snapshotCaptureResultValidator,
  handler: async (ctx, args): Promise<SnapshotCaptureResult> => {
    const updates = await ctx.runQuery(
      internal.yjsSync.internalQueries.listUpdatesForDocumentThroughSeq,
      {
        documentId: args.documentId,
        maxSeq: args.maxSeq,
      },
    )
    const data = encodeYjsSnapshot(updates)

    return await ctx.runMutation(internal.yjsSync.internalMutations.commitYjsSnapshotCapture, {
      itemId: args.documentId,
      itemType: args.itemType,
      editHistoryId: args.editHistoryId,
      campaignId: args.campaignId,
      expectedRevision: args.expectedRevision,
      data,
    })
  },
})
