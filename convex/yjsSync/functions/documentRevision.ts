import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'

type DocumentRevisionCtx = Pick<QueryCtx | MutationCtx, 'db'>

export async function getYjsDocumentRevision(
  ctx: DocumentRevisionCtx,
  documentId: Id<'sidebarItems'>,
): Promise<number> {
  const state = await ctx.db
    .query('yjsDocumentStates')
    .withIndex('by_document', (q) => q.eq('documentId', documentId))
    .unique()
  return state?.revision ?? 0
}

export async function advanceYjsDocumentRevision(
  ctx: Pick<MutationCtx, 'db'>,
  documentId: Id<'sidebarItems'>,
  currentRevision: number,
): Promise<number> {
  const state = await ctx.db
    .query('yjsDocumentStates')
    .withIndex('by_document', (q) => q.eq('documentId', documentId))
    .unique()
  const revision = currentRevision + 1

  if (state) {
    await ctx.db.patch('yjsDocumentStates', state._id, { revision })
  } else {
    await ctx.db.insert('yjsDocumentStates', { documentId, revision })
  }

  return revision
}
