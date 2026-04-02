import * as Y from 'yjs'
import { uint8ToArrayBuffer } from './uint8ToArrayBuffer'
import type { MutationCtx } from '../../_generated/server'
import type { YjsDocumentId } from './types'

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
  let update: ArrayBuffer
  if (initialState) {
    update = initialState
  } else {
    const doc = new Y.Doc()
    update = uint8ToArrayBuffer(Y.encodeStateAsUpdate(doc))
    doc.destroy()
  }

  const existing = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) =>
      q.eq('documentId', documentId).eq('seq', 0),
    )
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
