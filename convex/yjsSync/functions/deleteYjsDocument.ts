import { asyncMap } from 'convex-helpers'
import type { MutationCtx } from '../../_generated/server'
import type { SidebarItemId } from '../../../shared/common/ids'

export async function deleteYjsDocument(ctx: Pick<MutationCtx, 'db'>, documentId: SidebarItemId) {
  const [updates, awareness, documentState] = await Promise.all([
    ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
      .collect(),
    ctx.db
      .query('yjsAwareness')
      .withIndex('by_document', (q) => q.eq('documentId', documentId))
      .collect(),
    ctx.db
      .query('yjsDocumentStates')
      .withIndex('by_document', (q) => q.eq('documentId', documentId))
      .unique(),
  ])

  await Promise.all([
    asyncMap(updates, (row) => ctx.db.delete('yjsUpdates', row._id)),
    asyncMap(awareness, (row) => ctx.db.delete('yjsAwareness', row._id)),
    documentState ? ctx.db.delete('yjsDocumentStates', documentState._id) : Promise.resolve(),
  ])
}
