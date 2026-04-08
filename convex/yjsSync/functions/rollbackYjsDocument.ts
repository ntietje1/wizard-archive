import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function rollbackYjsDocument(
  ctx: AuthMutationCtx,
  documentId: Id<'notes'> | Id<'canvases'>,
  snapshotData: ArrayBuffer,
): Promise<void> {
  const existingUpdates = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
    .collect()

  await Promise.all(existingUpdates.map((row) => ctx.db.delete(row._id)))

  await ctx.db.insert('yjsUpdates', {
    documentId,
    update: snapshotData,
    seq: 0,
    isSnapshot: true,
  })
}
