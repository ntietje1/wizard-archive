import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'

export async function deleteYjsDocument(
  ctx: MutationCtx,
  documentId: Id<'notes'>,
) {
  const [updates, awareness] = await Promise.all([
    ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
      .collect(),
    ctx.db
      .query('yjsAwareness')
      .withIndex('by_document', (q) => q.eq('documentId', documentId))
      .collect(),
  ])

  await Promise.all([
    ...updates.map((row) => ctx.db.delete(row._id)),
    ...awareness.map((row) => ctx.db.delete(row._id)),
  ])
}
