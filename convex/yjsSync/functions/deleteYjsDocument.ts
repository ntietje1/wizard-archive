import { asyncMap } from 'convex-helpers'
import type { MutationCtx } from '../../_generated/server'
import type { YjsDocumentId } from './types'

export async function deleteYjsDocument(ctx: Pick<MutationCtx, 'db'>, documentId: YjsDocumentId) {
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
    asyncMap(updates, (row) => ctx.db.delete('yjsUpdates', row._id)),
    asyncMap(awareness, (row) => ctx.db.delete('yjsAwareness', row._id)),
  ])
}
