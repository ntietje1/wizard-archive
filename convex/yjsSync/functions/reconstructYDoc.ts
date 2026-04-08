import * as Y from 'yjs'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { YjsDocumentId } from './types'

export async function reconstructYDoc(
  ctx: QueryCtx | MutationCtx,
  documentId: YjsDocumentId,
) {
  const updates = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
    .order('asc')
    .collect()

  const doc = new Y.Doc()
  for (const row of updates) {
    Y.applyUpdate(doc, new Uint8Array(row.update))
  }

  return { doc, updates }
}
