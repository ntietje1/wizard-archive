import type { MutationCtx } from '../../_generated/server'
import type { YjsDocumentId } from '../../../shared/yjs-sync/types'

const EMPTY_YJS_UPDATE = new Uint8Array([0, 0]).buffer as ArrayBuffer

export async function createYjsDocument(
  ctx: MutationCtx,
  {
    documentId,
    initialState,
  }: {
    documentId: YjsDocumentId
    initialState?: ArrayBuffer
  },
) {
  const update = initialState ?? EMPTY_YJS_UPDATE

  const existing = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', documentId).eq('seq', 0))
    .first()

  if (!existing) {
    await ctx.db.insert('yjsUpdates', {
      documentId,
      update,
      seq: 0,
      isSnapshot: true,
    })
  }
}
