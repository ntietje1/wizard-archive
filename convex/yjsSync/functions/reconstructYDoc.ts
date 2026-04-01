import * as Y from 'yjs'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'

export async function reconstructYDoc(
  ctx: QueryCtx | MutationCtx,
  documentId: Id<'notes'>,
) {
  const updates = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
    .collect()

  const doc = new Y.Doc()
  for (const row of updates) {
    Y.applyUpdate(doc, new Uint8Array(row.update))
  }

  return { doc, updates }
}
