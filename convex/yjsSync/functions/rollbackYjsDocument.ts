import { asyncMap } from 'convex-helpers'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import { advanceYjsDocumentRevision, getYjsDocumentRevision } from './documentRevision'

const DELETE_BATCH_SIZE = 100

export async function rollbackYjsDocument(
  ctx: CampaignMutationCtx,
  documentId: Id<'sidebarItems'>,
  snapshotData: ArrayBuffer,
  expected: { revision: number; seq: number },
): Promise<boolean> {
  const doc = await ctx.db.get('sidebarItems', documentId)
  if (!doc) {
    throw new Error(`rollbackYjsDocument: document ${documentId} not found`)
  }

  const [latest, revision] = await Promise.all([
    ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
      .order('desc')
      .first(),
    getYjsDocumentRevision(ctx, documentId),
  ])
  if ((latest?.seq ?? -1) !== expected.seq || revision !== expected.revision) return false

  let hasMore = true
  while (hasMore) {
    const batch = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
      .take(DELETE_BATCH_SIZE)

    if (batch.length === 0) {
      hasMore = false
    } else {
      await asyncMap(batch, (row) => ctx.db.delete('yjsUpdates', row._id))
      if (batch.length < DELETE_BATCH_SIZE) hasMore = false
    }
  }

  await ctx.db.insert('yjsUpdates', {
    documentId: documentId,
    update: snapshotData,
    seq: expected.seq + 1,
    isSnapshot: true,
  })
  await advanceYjsDocumentRevision(ctx, documentId, revision)
  return true
}
