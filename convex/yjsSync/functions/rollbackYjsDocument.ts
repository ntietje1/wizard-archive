import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

const DELETE_BATCH_SIZE = 100

export async function rollbackYjsDocument(
  ctx: AuthMutationCtx,
  documentId: Id<'notes'> | Id<'canvases'>,
  snapshotData: ArrayBuffer,
): Promise<void> {
  const doc = await ctx.db.get(documentId)
  if (!doc) {
    throw new Error(`rollbackYjsDocument: document ${documentId} not found`)
  }

  let hasMore = true
  while (hasMore) {
    const batch = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
      .take(DELETE_BATCH_SIZE)

    if (batch.length === 0) {
      hasMore = false
    } else {
      await Promise.all(batch.map((row) => ctx.db.delete(row._id)))
      if (batch.length < DELETE_BATCH_SIZE) hasMore = false
    }
  }

  await ctx.db.insert('yjsUpdates', {
    documentId,
    update: snapshotData,
    seq: 0,
    isSnapshot: true,
  })
}
